import nodemailer, { Transporter } from 'nodemailer';

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  previewUrl?: string | false;
  error?: string;
}

// Cached transporter
let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.PORT || '587', 10) : 587;

  if (smtpHost && smtpUser && smtpPass) {
    // Real custom SMTP server configured in environment
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });
  } else {
    // If no custom SMTP credentials, use an ephemeral test account or jsonTransport with ethereal
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log(`[EmailService] Initialized test Ethereal SMTP account: ${testAccount.user}`);
    } catch {
      // Fallback to json transport
      transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  return transporter;
}

const FROM_ADDRESS =
  process.env.SMTP_FROM || 'Meditory District Health Authority <notifications@meditory.gov.in>';

/**
 * 1. Send Clinic Registration Application Received Email
 */
export async function sendClinicRegistrationSubmittedEmail(params: {
  toEmail: string;
  doctorName: string;
  facilityName: string;
  facilityId: string;
  districtName: string;
  taluka?: string;
  phone: string;
}): Promise<EmailDeliveryResult> {
  try {
    const transport = await getTransporter();

    const subject = `📋 [Meditory] Clinic Application Received - ${params.facilityName} (${params.facilityId})`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #0f766e; color: #ffffff; padding: 24px 28px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #ccfbf1; }
    .content { padding: 28px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #fef3c7; color: #92400e; border: 1px solid #fde68a; margin-bottom: 16px; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    .details-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .details-table td.label { font-weight: 600; color: #64748b; width: 40%; }
    .details-table td.value { font-weight: 500; color: #0f172a; }
    .notice-box { background: #f0fdfa; border-left: 4px solid #0f766e; padding: 14px 16px; border-radius: 4px; font-size: 13px; color: #134e4a; margin: 20px 0; }
    .footer { padding: 18px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Meditory Health Authority</h1>
      <p>Clinic-to-Clinic Medicine Inventory & Emergency Referral Network</p>
    </div>
    <div class="content">
      <div class="badge">Application Status: Pending District Approval</div>
      <h2 style="margin-top:0; font-size: 17px; color: #0f172a;">Application Submitted Successfully</h2>
      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        Dear <strong>Dr. ${params.doctorName}</strong>,
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #475569;">
        Your registration application for <strong>${params.facilityName}</strong> has been successfully received by the Meditory District Health Authority.
      </p>

      <table class="details-table">
        <tr>
          <td class="label">Facility Reference ID</td>
          <td class="value"><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:700; color:#0f766e;">${params.facilityId}</code></td>
        </tr>
        <tr>
          <td class="label">Health Facility Name</td>
          <td class="value"><strong>${params.facilityName}</strong></td>
        </tr>
        <tr>
          <td class="label">District & Taluka</td>
          <td class="value">${params.taluka ? `${params.taluka}, ` : ''}${params.districtName} District</td>
        </tr>
        <tr>
          <td class="label">Lead Medical Officer</td>
          <td class="value">${params.doctorName}</td>
        </tr>
        <tr>
          <td class="label">Registered Email</td>
          <td class="value">${params.toEmail}</td>
        </tr>
        <tr>
          <td class="label">Contact Phone</td>
          <td class="value">${params.phone}</td>
        </tr>
      </table>

      <div class="notice-box">
        <strong>What happens next?</strong><br>
        Your application is currently under review by the District Health Mission Administrator. Once verified and approved, your terminal accounts will be activated, a starter emergency formulary (ASV, ARV, ORS) will be provisioned, and you will receive an approval confirmation email with access instructions.
      </div>
    </div>
    <div class="footer">
      National Health Mission (NHM) • Meditory Rural Digital Health Network<br>
      This is an automated notification from the District Health Administration.
    </div>
  </div>
</body>
</html>
    `;

    const info = await transport.sendMail({
      from: FROM_ADDRESS,
      to: params.toEmail,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`\n======================================================`);
    console.log(`✉️ [Email Sent: Registration Submitted]`);
    console.log(`   To: ${params.toEmail}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Facility: ${params.facilityName} (${params.facilityId})`);
    if (previewUrl) {
      console.log(`   🔗 Ethereal Preview URL: ${previewUrl}`);
    }
    console.log(`======================================================\n`);

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || undefined,
    };
  } catch (err) {
    console.error('[EmailService] Failed to send registration submitted email:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown email error',
    };
  }
}

/**
 * 2. Send Clinic Application Approved & Activated Email
 */
export async function sendClinicApprovalEmail(params: {
  toEmail: string;
  doctorName: string;
  facilityName: string;
  facilityId: string;
  districtName?: string;
  approvedBy?: string;
  approvedAt?: string;
  seededItemsCount?: number;
}): Promise<EmailDeliveryResult> {
  try {
    const transport = await getTransporter();

    const subject = `🎉 [Meditory] Clinic Application APPROVED - ${params.facilityName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #047857; color: #ffffff; padding: 24px 28px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #a7f3d0; }
    .content { padding: 28px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #d1fae5; color: #065f46; border: 1px solid #a7f3d0; margin-bottom: 16px; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    .details-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .details-table td.label { font-weight: 600; color: #64748b; width: 40%; }
    .details-table td.value { font-weight: 500; color: #0f172a; }
    .formulary-box { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px 16px; border-radius: 8px; font-size: 13px; color: #166534; margin: 20px 0; }
    .cta-btn { display: inline-block; padding: 12px 24px; background: #047857; color: #ffffff !important; font-weight: 700; font-size: 13px; text-decoration: none; border-radius: 8px; margin-top: 12px; }
    .footer { padding: 18px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Meditory Health Authority</h1>
      <p>Clinic-to-Clinic Medicine Inventory & Emergency Referral Network</p>
    </div>
    <div class="content">
      <div class="badge">Status: Approved & Active</div>
      <h2 style="margin-top:0; font-size: 17px; color: #0f172a;">Application Approved — Terminal Activated</h2>
      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        Dear <strong>Dr. ${params.doctorName}</strong>,
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #475569;">
        We are pleased to inform you that your application for <strong>${params.facilityName}</strong> has been officially <strong>APPROVED</strong> by the District Health Authority.
      </p>

      <table class="details-table">
        <tr>
          <td class="label">Facility Reference ID</td>
          <td class="value"><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-weight:700; color:#047857;">${params.facilityId}</code></td>
        </tr>
        <tr>
          <td class="label">Health Facility Name</td>
          <td class="value"><strong>${params.facilityName}</strong></td>
        </tr>
        <tr>
          <td class="label">Approved By</td>
          <td class="value">${params.approvedBy || 'District Health Mission Admin'}</td>
        </tr>
        <tr>
          <td class="label">Approval Timestamp</td>
          <td class="value">${params.approvedAt || new Date().toLocaleString()}</td>
        </tr>
        <tr>
          <td class="label">Login Email</td>
          <td class="value"><strong>${params.toEmail}</strong></td>
        </tr>
      </table>

      <div class="formulary-box">
        <strong>📦 Starter Emergency Formulary Seeded:</strong><br>
        Your digital shelf inventory has been pre-provisioned with <strong>${params.seededItemsCount || 4} vital medicines</strong>:
        <ul style="margin: 8px 0 0 0; padding-left: 20px;">
          <li>10x Anti-Snake Venom (Polyvalent IP) [Emergency]</li>
          <li>15x Rabies Vaccine (Human) IP [Emergency Cold-Chain]</li>
          <li>200x Oral Rehydration Salts (WHO Formula)</li>
          <li>300x Paracetamol IP 500mg (Strips)</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 24px 0 12px 0;">
        <a href="http://localhost:3000/login" class="cta-btn">
          Access Dispensary Terminal →
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b; text-align: center;">
        Sign in using your email <code>${params.toEmail}</code> and the password chosen during registration.
      </p>
    </div>
    <div class="footer">
      National Health Mission (NHM) • Meditory Rural Digital Health Network<br>
      This is an automated notification from the District Health Administration.
    </div>
  </div>
</body>
</html>
    `;

    const info = await transport.sendMail({
      from: FROM_ADDRESS,
      to: params.toEmail,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`\n======================================================`);
    console.log(`✉️ [Email Sent: Clinic Application Approved]`);
    console.log(`   To: ${params.toEmail}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Facility: ${params.facilityName} (${params.facilityId})`);
    if (previewUrl) {
      console.log(`   🔗 Ethereal Preview URL: ${previewUrl}`);
    }
    console.log(`======================================================\n`);

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || undefined,
    };
  } catch (err) {
    console.error('[EmailService] Failed to send clinic approval email:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown email error',
    };
  }
}

/**
 * 3. Send Clinic Application Rejected Email
 */
export async function sendClinicRejectionEmail(params: {
  toEmail: string;
  doctorName: string;
  facilityName: string;
  facilityId: string;
  rejectionReason?: string;
  rejectedBy?: string;
}): Promise<EmailDeliveryResult> {
  try {
    const transport = await getTransporter();

    const subject = `⚠️ [Meditory] Notice regarding Clinic Application - ${params.facilityName}`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header { background: #b91c1c; color: #ffffff; padding: 24px 28px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    .header p { margin: 4px 0 0 0; font-size: 13px; color: #fecaca; }
    .content { padding: 28px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; margin-bottom: 16px; }
    .details-table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
    .details-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; }
    .details-table td.label { font-weight: 600; color: #64748b; width: 40%; }
    .details-table td.value { font-weight: 500; color: #0f172a; }
    .reason-box { background: #fef2f2; border-left: 4px solid #b91c1c; padding: 14px 16px; border-radius: 4px; font-size: 13px; color: #7f1d1d; margin: 20px 0; }
    .footer { padding: 18px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Meditory Health Authority</h1>
      <p>Clinic-to-Clinic Medicine Inventory & Emergency Referral Network</p>
    </div>
    <div class="content">
      <div class="badge">Application Status: Rejected / Action Required</div>
      <h2 style="margin-top:0; font-size: 17px; color: #0f172a;">Application Review Update</h2>
      <p style="font-size: 14px; line-height: 1.5; color: #334155;">
        Dear <strong>Dr. ${params.doctorName}</strong>,
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #475569;">
        This email is to notify you that the registration application for <strong>${params.facilityName}</strong> (${params.facilityId}) could not be approved at this time.
      </p>

      <div class="reason-box">
        <strong>Review Remarks / Reason:</strong><br>
        ${params.rejectionReason || 'Facility registration documentation or credentials did not meet district verification requirements.'}
      </div>

      <p style="font-size: 13px; color: #475569;">
        If you believe this is an error or would like to submit corrected facility documentation, please contact your District Health Office or re-apply via the registration portal.
      </p>
    </div>
    <div class="footer">
      National Health Mission (NHM) • Meditory Rural Digital Health Network<br>
      This is an automated notification from the District Health Administration.
    </div>
  </div>
</body>
</html>
    `;

    const info = await transport.sendMail({
      from: FROM_ADDRESS,
      to: params.toEmail,
      subject,
      html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`\n======================================================`);
    console.log(`✉️ [Email Sent: Clinic Application Rejected]`);
    console.log(`   To: ${params.toEmail}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Facility: ${params.facilityName} (${params.facilityId})`);
    if (previewUrl) {
      console.log(`   🔗 Ethereal Preview URL: ${previewUrl}`);
    }
    console.log(`======================================================\n`);

    return {
      success: true,
      messageId: info.messageId,
      previewUrl: previewUrl || undefined,
    };
  } catch (err) {
    console.error('[EmailService] Failed to send clinic rejection email:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown email error',
    };
  }
}
