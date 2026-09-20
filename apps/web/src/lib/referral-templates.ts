/**
 * Standardized Clinical Emergency Referral Slip Generator for SMS and WhatsApp
 * Compliant with National Health Mission (NHM) Inter-Facility Transfer Guidelines
 */

export interface EmergencyReferralData {
  patientName: string;
  patientAge?: string | number;
  patientGender?: 'Male' | 'Female' | 'Other';
  diagnosis: string;
  drugNeeded: string;
  dosageOrQty?: string | number;
  urgency: 'CRITICAL (Immediate Ambulance)' | 'HIGH PRIORITY' | 'ROUTINE';
  referringFacility: string;
  referringDoctor: string;
  referringPhone: string;
  receivingFacility: string;
  receivingDoctor?: string;
  receivingPhone?: string;
  ambulanceStatus?: '108 Ambulance Dispatched' | '108 Awaiting En Route' | 'Private/Family Vehicle' | 'Direct Hospital Transport';
  clinicalNotes?: string;
}

/**
 * Format referral data into a standardized message
 */
export function formatEmergencyReferralText(data: EmergencyReferralData): string {
  const timestamp = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

  const lines = [
    `🚨 *EMERGENCY PATIENT REFERRAL* 🚨`,
    `*Meditory Rural Health Network • Bharat*`,
    `----------------------------------------`,
    `*PATIENT PROFILE:*`,
    `• Name: ${data.patientName || 'Emergency Patient (Triage Walk-in)'}`,
    data.patientAge || data.patientGender
      ? `• Demographics: ${[data.patientAge ? `${data.patientAge} yrs` : '', data.patientGender || ''].filter(Boolean).join(' • ')}`
      : null,
    `• Emergency Condition: ${data.diagnosis || 'Acute Medical Emergency'}`,
    `• Critical Drug Required: *${data.drugNeeded}* ${data.dosageOrQty ? `(${data.dosageOrQty} units)` : ''}`,
    `• Urgency Tier: 🔴 *${data.urgency}*`,
    ``,
    `*REFERRING FACILITY (ORIGIN):*`,
    `• Clinic: ${data.referringFacility}`,
    `• Medical Officer: ${data.referringDoctor}`,
    `• Desk Emergency Phone: ${data.referringPhone}`,
    ``,
    `*RECEIVING FACILITY (DESTINATION):*`,
    `• Clinic: ${data.receivingFacility}`,
    data.receivingDoctor ? `• Doctor In-Charge: ${data.receivingDoctor}` : null,
    data.receivingPhone ? `• Emergency Desk Line: ${data.receivingPhone}` : null,
    ``,
    `*TRANSIT & DISPATCH:*`,
    `• Transit Mode: ${data.ambulanceStatus || '108 Ambulance Service'}`,
    `• Referral Dispatched At: ${timestamp} IST`,
    data.clinicalNotes ? `• Clinical Notes: ${data.clinicalNotes}` : null,
    `----------------------------------------`,
    `⚠️ *ACTION REQUESTED:* Please prepare triage emergency bed, IV resuscitation, and cold-chain storage unit prior to patient arrival.`,
  ];

  return lines.filter((line) => line !== null).join('\n');
}

/**
 * Clean phone number to digits only (with country code 91 default for India)
 */
export function cleanPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.startsWith('91') && digits.length === 12) {
    return digits;
  }
  if (digits.length > 10 && !digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

/**
 * Generates WhatsApp click-to-chat URL
 */
export function getWhatsAppShareUrl(phone: string | undefined, referralText: string): string {
  const cleaned = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(referralText);
  if (cleaned && cleaned.length >= 10) {
    return `https://wa.me/${cleaned}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Generates SMS URI for mobile dispatch
 */
export function getSmsShareUrl(phone: string | undefined, referralText: string): string {
  const cleaned = cleanPhoneNumber(phone);
  const encodedText = encodeURIComponent(referralText);
  if (cleaned) {
    return `sms:${cleaned}?body=${encodedText}`;
  }
  return `sms:?body=${encodedText}`;
}
