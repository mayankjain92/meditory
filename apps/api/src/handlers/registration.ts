import { APIGatewayProxyEventV2 } from 'aws-lambda';
import bcrypt from 'bcryptjs';
import {
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  TABLE_NAMES,
  FACILITY_TYPE,
  DRUG_TIER,
  STOCK_STATUS,
  Facility,
  FacilityWorker,
  InventoryItem,
} from '@meditory/shared';
import { docClient } from '../shared/ddb.js';
import { successResponse, badRequest, unauthorized, notFound } from '../shared/response.js';
import {
  sendClinicRegistrationSubmittedEmail,
  sendClinicApprovalEmail,
  sendClinicRejectionEmail,
} from '../shared/email-service.js';

export interface ClinicRegistrationRequest {
  name: string;
  type?: 'PHC' | 'CHC' | 'SUB_CENTRE';
  districtName?: string;
  taluka?: string;
  pinCode?: string;
  address?: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  doctorName: string;
  doctorEmail: string;
  doctorPhone?: string;
  password: string;
}

/**
 * Starter Formulary for Newly Approved Clinics
 */
const STARTER_INVENTORY_ITEMS = [
  {
    drugId: 'DRUG-ASV-01',
    drugName: 'Anti-Snake Venom (Polyvalent IP)',
    genericName: 'Anti-Snake Venom Serum',
    category: 'Emergency Antidotes',
    form: '10ml Vial (Lyophilized)',
    quantity: 10,
    unit: 'vials',
    threshold: 5,
    tier: DRUG_TIER.EMERGENCY,
    isCritical: true,
  },
  {
    drugId: 'DRUG-ARV-02',
    drugName: 'Rabies Vaccine (Human) IP',
    genericName: 'Purified Chick Embryo Cell Vaccine',
    category: 'Emergency Vaccines',
    form: '1.0ml Vial with Diluent',
    quantity: 15,
    unit: 'vials',
    threshold: 5,
    tier: DRUG_TIER.EMERGENCY,
    isCritical: true,
  },
  {
    drugId: 'DRUG-ORS-03',
    drugName: 'Oral Rehydration Salts (WHO Formula)',
    genericName: 'Sodium Chloride, Dextrose, Potassium Chloride',
    category: 'Maternal & Child Health',
    form: '20.5g Powder Sachet',
    quantity: 200,
    unit: 'sachets',
    threshold: 40,
    tier: DRUG_TIER.ESSENTIAL,
    isCritical: false,
  },
  {
    drugId: 'DRUG-PCM-04',
    drugName: 'Paracetamol IP 500mg',
    genericName: 'Acetaminophen',
    category: 'General OPD Formulary',
    form: 'Strip of 10 Tablets',
    quantity: 300,
    unit: 'strips',
    threshold: 50,
    tier: DRUG_TIER.ROUTINE,
    isCritical: false,
  },
];

/**
 * POST /facilities/register
 * Allows a rural clinic (PHC/CHC/Sub-Center) to self-register for Meditory.
 * The facility and lead doctor are saved in 'PENDING_APPROVAL' state.
 */
export async function registerFacilityHandler(event: APIGatewayProxyEventV2) {
  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: ClinicRegistrationRequest;
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const {
    name,
    type = 'PHC',
    districtName = 'Raigad',
    taluka = '',
    pinCode = '',
    address = '',
    phone,
    latitude = 18.65,
    longitude = 73.0,
    doctorName,
    doctorEmail,
    doctorPhone,
    password,
  } = body;

  if (!name || !name.trim()) {
    return badRequest('Clinic facility name is required.');
  }
  if (!phone || !phone.trim()) {
    return badRequest('Clinic contact phone is required.');
  }
  if (!doctorName || !doctorName.trim()) {
    return badRequest('Lead Medical Officer name is required.');
  }
  if (!doctorEmail || !doctorEmail.trim() || !doctorEmail.includes('@')) {
    return badRequest('A valid official doctor email is required.');
  }
  if (!password || password.trim().length < 6) {
    return badRequest('Secure password must be at least 6 characters.');
  }

  const normalizedEmail = doctorEmail.toLowerCase().trim();

  // 1. Check if email is already taken
  const existingWorkerRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.WORKERS,
      Key: { email: normalizedEmail },
    })
  );

  if (existingWorkerRes.Item) {
    return badRequest(`Email '${normalizedEmail}' is already registered in the Meditory health directory.`);
  }

  const now = new Date().toISOString();
  // Generate Clean Facility ID e.g. PHC-ROHA-8402
  const sanitizedClinicName = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
  const facilityId = `${type}-${sanitizedClinicName}-${Math.floor(1000 + Math.random() * 9000)}`;
  const workerId = `USR-${Math.floor(10000 + Math.random() * 90000)}`;
  const districtId = `DISTRICT-${districtName.toUpperCase().replace(/\s+/g, '-')}`;

  const fullAddress = address.trim()
    ? `${address.trim()}${taluka ? `, ${taluka}` : ''}${pinCode ? ` - ${pinCode}` : ''}`
    : `${taluka ? `${taluka}, ` : ''}${districtName} District${pinCode ? ` - ${pinCode}` : ''}`;

  const hashedPassword = bcrypt.hashSync(password, 10);

  const facilityRecord = {
    id: facilityId,
    name: name.trim(),
    districtId,
    districtName: districtName.trim(),
    type: type as any,
    phone: phone.trim(),
    address: fullAddress,
    latitude: typeof latitude === 'number' ? latitude : 18.65,
    longitude: typeof longitude === 'number' ? longitude : 73.0,
    createdAt: now,
    isApproved: false,
    approvalStatus: 'PENDING',
    leadDoctorName: doctorName.trim(),
    leadDoctorEmail: normalizedEmail,
    leadDoctorPhone: doctorPhone?.trim() || phone.trim(),
    taluka: taluka.trim() || undefined,
    pinCode: pinCode.trim() || undefined,
  };

  const workerRecord = {
    id: workerId,
    facilityId,
    name: doctorName.trim(),
    email: normalizedEmail,
    role: 'facility_worker' as const,
    status: 'INACTIVE' as const, // Inactive until authority approval
    passwordHash: hashedPassword,
    createdAt: now,
  };

  // 2. Atomically insert facility and worker registration
  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TABLE_NAMES.FACILITIES,
            Item: facilityRecord,
          },
        },
        {
          Put: {
            TableName: TABLE_NAMES.WORKERS,
            Item: workerRecord,
          },
        },
      ],
    })
  );

  // 3. Send real email notification to lead medical officer
  const emailRes = await sendClinicRegistrationSubmittedEmail({
    toEmail: normalizedEmail,
    doctorName: doctorName.trim(),
    facilityName: name.trim(),
    facilityId,
    districtName: districtName.trim(),
    taluka: taluka.trim() || undefined,
    phone: phone.trim(),
  });

  return successResponse(
    {
      success: true,
      message: 'Clinic application registered successfully. Pending District Health Authority approval.',
      registrationId: facilityId,
      facility: {
        id: facilityId,
        name: facilityRecord.name,
        type: facilityRecord.type,
        district: facilityRecord.districtName,
        approvalStatus: facilityRecord.approvalStatus,
        createdAt: facilityRecord.createdAt,
      },
      leadDoctor: {
        id: workerId,
        name: workerRecord.name,
        email: workerRecord.email,
        status: workerRecord.status,
      },
      emailNotification: {
        sent: emailRes.success,
        recipient: normalizedEmail,
        previewUrl: emailRes.previewUrl || undefined,
      },
    },
    201
  );
}

/**
 * GET /admin/registrations
 * Retrieves all registered clinics, highlighting pending approval applications.
 */
export async function getPendingRegistrationsHandler(event: APIGatewayProxyEventV2) {
  const statusFilter = event.queryStringParameters?.status?.toUpperCase();

  const scanRes = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAMES.FACILITIES,
    })
  );

  let facilities = (scanRes.Items || []) as Array<
    Facility & {
      isApproved?: boolean;
      approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
      leadDoctorName?: string;
      leadDoctorEmail?: string;
      leadDoctorPhone?: string;
      approvedAt?: string;
      rejectionReason?: string;
    }
  >;

  // Normalize legacy facilities as APPROVED
  facilities = facilities.map((f) => ({
    ...f,
    approvalStatus: f.approvalStatus || (f.isApproved === false ? 'PENDING' : 'APPROVED'),
    isApproved: f.isApproved ?? true,
  }));

  if (statusFilter) {
    facilities = facilities.filter((f) => f.approvalStatus === statusFilter);
  }

  // Sort: PENDING applications first, then by newest
  facilities.sort((a, b) => {
    if (a.approvalStatus === 'PENDING' && b.approvalStatus !== 'PENDING') return -1;
    if (b.approvalStatus === 'PENDING' && a.approvalStatus !== 'PENDING') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const pendingCount = facilities.filter((f) => f.approvalStatus === 'PENDING').length;
  const approvedCount = facilities.filter((f) => f.approvalStatus === 'APPROVED').length;

  return successResponse({
    success: true,
    total: facilities.length,
    pendingCount,
    approvedCount,
    facilities,
  });
}

/**
 * POST /admin/registrations/approve
 * District / State Administrator approves a clinic application, activates their accounts,
 * and initializes starter shelf formulary.
 */
export async function approveRegistrationHandler(event: APIGatewayProxyEventV2) {
  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: { facilityId: string; remarks?: string; approvedBy?: string };
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const { facilityId, remarks, approvedBy = 'State Health Mission Admin' } = body;
  if (!facilityId) {
    return badRequest('facilityId is required.');
  }

  // 1. Fetch Facility
  const facRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.FACILITIES,
      Key: { id: facilityId },
    })
  );

  const facility = facRes.Item as
    | (Facility & {
        isApproved?: boolean;
        approvalStatus?: string;
        leadDoctorEmail?: string;
        leadDoctorName?: string;
      })
    | undefined;

  if (!facility) {
    return notFound(`Clinic facility '${facilityId}' not found.`);
  }

  const now = new Date().toISOString();

  // 2. Update Facility to APPROVED
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAMES.FACILITIES,
      Key: { id: facilityId },
      UpdateExpression:
        'SET isApproved = :true, approvalStatus = :approved, approvedAt = :now, approvedBy = :by, approvalRemarks = :rem',
      ExpressionAttributeValues: {
        ':true': true,
        ':approved': 'APPROVED',
        ':now': now,
        ':by': approvedBy,
        ':rem': remarks || 'Approved by District Administration',
      },
    })
  );

  // 3. Activate associated worker(s) in Meditory_Workers
  if (facility.leadDoctorEmail) {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAMES.WORKERS,
        Key: { email: facility.leadDoctorEmail },
        UpdateExpression: 'SET #st = :active, activatedAt = :now',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':active': 'ACTIVE',
          ':now': now,
        },
      })
    );
  } else {
    // Scan and activate all workers for this facilityId
    const workersRes = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAMES.WORKERS,
        FilterExpression: 'facilityId = :fId',
        ExpressionAttributeValues: { ':fId': facilityId },
      })
    );
    for (const w of workersRes.Items || []) {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAMES.WORKERS,
          Key: { email: w.email },
          UpdateExpression: 'SET #st = :active, activatedAt = :now',
          ExpressionAttributeNames: { '#st': 'status' },
          ExpressionAttributeValues: {
            ':active': 'ACTIVE',
            ':now': now,
          },
        })
      );
    }
  }

  // 4. Seed Starter Inventory into Meditory_Inventory for this newly approved clinic
  let seededItemsCount = 0;
  for (const item of STARTER_INVENTORY_ITEMS) {
    const invItem: InventoryItem = {
      facilityId,
      drugId: item.drugId,
      drugName: item.drugName,
      genericName: item.genericName,
      category: item.category,
      form: item.form,
      quantity: item.quantity,
      unit: item.unit,
      threshold: item.threshold,
      tier: item.tier as any,
      isCritical: item.isCritical,
      status: STOCK_STATUS.IN_STOCK,
      updatedAt: now,
      lastRestockedAt: now,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.INVENTORY,
        Item: invItem,
      })
    );
    seededItemsCount++;
  }

  // 5. Send real email notification to lead medical officer
  let emailRes: any = { success: false };
  if (facility.leadDoctorEmail) {
    emailRes = await sendClinicApprovalEmail({
      toEmail: facility.leadDoctorEmail,
      doctorName: facility.leadDoctorName || 'Medical Officer',
      facilityName: facility.name,
      facilityId,
      districtName: facility.districtName,
      approvedBy,
      approvedAt: now,
      seededItemsCount,
    });
  }

  return successResponse({
    success: true,
    message: `Clinic '${facility.name}' approved successfully. Worker accounts activated and starter inventory seeded.`,
    facilityId,
    status: 'APPROVED',
    approvedAt: now,
    seededItemsCount,
    emailNotification: {
      sent: emailRes.success,
      recipient: facility.leadDoctorEmail,
      previewUrl: emailRes.previewUrl || undefined,
    },
  });
}

/**
 * POST /admin/registrations/reject
 * Rejects a clinic application with remarks.
 */
export async function rejectRegistrationHandler(event: APIGatewayProxyEventV2) {
  if (!event.body) {
    return badRequest('Request body is required.');
  }

  let body: { facilityId: string; rejectionReason?: string; rejectedBy?: string };
  try {
    body = JSON.parse(event.body);
  } catch {
    return badRequest('Invalid JSON payload.');
  }

  const { facilityId, rejectionReason = 'Application verification incomplete', rejectedBy = 'State Health Mission Admin' } = body;
  if (!facilityId) {
    return badRequest('facilityId is required.');
  }

  // Fetch facility to get lead doctor contact details
  const facRes = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.FACILITIES,
      Key: { id: facilityId },
    })
  );
  const facility = facRes.Item as
    | (Facility & { leadDoctorEmail?: string; leadDoctorName?: string })
    | undefined;

  const now = new Date().toISOString();

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAMES.FACILITIES,
      Key: { id: facilityId },
      UpdateExpression:
        'SET isApproved = :false, approvalStatus = :rejected, rejectedAt = :now, rejectedBy = :by, rejectionReason = :reason',
      ExpressionAttributeValues: {
        ':false': false,
        ':rejected': 'REJECTED',
        ':now': now,
        ':by': rejectedBy,
        ':reason': rejectionReason,
      },
    })
  );

  let emailRes: any = { success: false };
  if (facility?.leadDoctorEmail) {
    emailRes = await sendClinicRejectionEmail({
      toEmail: facility.leadDoctorEmail,
      doctorName: facility.leadDoctorName || 'Medical Officer',
      facilityName: facility.name || facilityId,
      facilityId,
      rejectionReason,
      rejectedBy,
    });
  }

  return successResponse({
    success: true,
    message: `Clinic application '${facilityId}' marked as REJECTED.`,
    facilityId,
    status: 'REJECTED',
    rejectionReason,
    emailNotification: {
      sent: emailRes.success,
      recipient: facility?.leadDoctorEmail,
      previewUrl: emailRes.previewUrl || undefined,
    },
  });
}
