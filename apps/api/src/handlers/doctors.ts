import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAMES, Facility, FacilityWorker } from '@meditory/shared';
import { docClient } from '../shared/ddb.js';
import { getAuthenticatedSession } from '../authorizer/index.js';
import { successResponse, unauthorized } from '../shared/response.js';

/**
 * GET /clinic/doctors
 * Retrieves the clinic's registered doctors, clinic name, and location from DynamoDB
 */
export async function doctorsHandler(event: APIGatewayProxyEventV2) {
  const session = getAuthenticatedSession(event);
  if (!session) {
    return unauthorized('Authentication required to access clinic doctors and staff directory.');
  }
  const currentFacilityId = session.facilityId;

  // 1. Fetch facilities from DB
  const facRes = await docClient.send(new ScanCommand({ TableName: TABLE_NAMES.FACILITIES }));
  const facilities = (facRes.Items || []) as Facility[];

  const currentFacility =
    facilities.find((f) => f.id === currentFacilityId) || facilities[0] || {
      id: 'PHC-ALIBAG-01',
      name: 'Alibag Primary Health Centre',
      address: 'Near Civil Hospital, Rewas Road, Alibag, Raigad - 402201',
      districtName: 'Raigad',
      phone: '+91 2141 222045',
      type: 'PHC',
    };

  // 2. Fetch workers/doctors from DB
  const workRes = await docClient.send(new ScanCommand({ TableName: TABLE_NAMES.WORKERS }));
  const workers = (workRes.Items || []) as (FacilityWorker & { status?: string })[];

  // Facility lookup map
  const facilityMap = new Map<string, any>(facilities.map((f) => [f.id, f]));

  // Filter workers/doctors for current facility
  let clinicDoctors = workers
    .filter((w) => w.facilityId === currentFacility.id && w.status !== 'INACTIVE')
    .map((w) => ({
      id: w.id,
      name: w.name,
      email: w.email,
      role: w.role,
      facilityId: w.facilityId,
      facilityName: currentFacility.name,
      facilityAddress: currentFacility.address,
      facilityDistrict: currentFacility.districtName,
      phone: currentFacility.phone,
    }));

  // Fallback: if no active worker for current facility, use lead doctor from facility record
  if (clinicDoctors.length === 0 && (currentFacility as any).leadDoctorName) {
    clinicDoctors.push({
      id: `USR-${currentFacility.id}`,
      name: (currentFacility as any).leadDoctorName,
      email: (currentFacility as any).leadDoctorEmail || 'doctor@clinic.in',
      role: 'facility_worker',
      facilityId: currentFacility.id,
      facilityName: currentFacility.name,
      facilityAddress: currentFacility.address,
      facilityDistrict: currentFacility.districtName,
      phone: (currentFacility as any).leadDoctorPhone || currentFacility.phone,
    });
  }

  // Filter out rejected facilities
  const approvedFacilities = facilities.filter((f: any) => f.approvalStatus !== 'REJECTED');

  // All approved network facilities for inter-facility transfers / emergency routing / directory
  const networkFacilities = approvedFacilities.map((f: any) => ({
    id: f.id,
    name: f.name,
    type: f.type || 'PHC',
    address: f.address || `${f.districtName || 'Raigad'} District`,
    districtName: f.districtName || 'Raigad',
    phone: f.phone || f.leadDoctorPhone || '+91 2141 222045',
    approvalStatus: f.approvalStatus || 'APPROVED',
    isCurrent: f.id === currentFacility.id,
  }));

  // Build complete directory across all approved facilities
  const directoryEntries: any[] = [];
  const processedEmails = new Set<string>();

  for (const w of workers) {
    if (w.status === 'INACTIVE') continue;
    const fac = facilityMap.get(w.facilityId);
    if (fac && fac.approvalStatus === 'REJECTED') continue;
    if (w.email) processedEmails.add(w.email.toLowerCase());
    directoryEntries.push({
      id: w.id,
      name: w.name,
      email: w.email,
      role: w.role,
      facilityId: w.facilityId,
      facilityName: fac?.name || 'Primary Health Centre',
      facilityType: fac?.type || 'PHC',
      facilityAddress: fac?.address || 'Raigad District, Maharashtra',
      facilityDistrict: fac?.districtName || 'Raigad',
      facilityPhone: fac?.phone || fac?.leadDoctorPhone || '+91 2141 222045',
      phone: fac?.phone || fac?.leadDoctorPhone || '+91 2141 222045',
      isCurrentFacility: w.facilityId === currentFacility.id,
    });
  }

  // Also include lead doctors from approved registered facilities if not already in directory
  for (const fac of approvedFacilities as any[]) {
    if (fac.leadDoctorName && fac.leadDoctorEmail && !processedEmails.has(fac.leadDoctorEmail.toLowerCase())) {
      directoryEntries.push({
        id: `USR-${fac.id}`,
        name: fac.leadDoctorName,
        email: fac.leadDoctorEmail,
        role: 'facility_worker',
        facilityId: fac.id,
        facilityName: fac.name,
        facilityType: fac.type || 'PHC',
        facilityAddress: fac.address,
        facilityDistrict: fac.districtName || 'Raigad',
        facilityPhone: fac.phone || fac.leadDoctorPhone || '+91 2141 222045',
        phone: fac.leadDoctorPhone || fac.phone || '+91 2141 222045',
        isCurrentFacility: fac.id === currentFacility.id,
      });
      processedEmails.add(fac.leadDoctorEmail.toLowerCase());
    }
  }

  return successResponse({
    currentFacility: {
      id: currentFacility.id,
      name: currentFacility.name,
      address: currentFacility.address,
      districtName: currentFacility.districtName,
      phone: currentFacility.phone || (currentFacility as any).leadDoctorPhone || '+91 2141 222045',
      type: currentFacility.type,
    },
    doctors: directoryEntries.length > 0 ? directoryEntries : clinicDoctors,
    facilityDoctors: clinicDoctors,
    facilities: networkFacilities,
    directory: directoryEntries,
  });
}
