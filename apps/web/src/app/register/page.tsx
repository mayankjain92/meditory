'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Hospital,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Lock,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  FileCheck2,
  Stethoscope,
  ExternalLink,
} from 'lucide-react';
import { api } from '@/lib/api-client';

export default function RegisterClinicPage() {
  const router = useRouter();

  // Facility Form State
  const [name, setName] = useState('');
  const [type, setType] = useState<'PHC' | 'CHC' | 'SUB_CENTRE'>('PHC');
  const [districtName, setDistrictName] = useState('Raigad');
  const [taluka, setTaluka] = useState('Roha');
  const [pinCode, setPinCode] = useState('402109');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('+91 2144 222120');
  const [latitude, setLatitude] = useState(18.4358);
  const [longitude, setLongitude] = useState(73.1197);

  // Lead Medical Officer State
  const [doctorName, setDoctorName] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('+91 98231 44552');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // UI Interactive State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [registeredData, setRegisteredData] = useState<{
    registrationId: string;
    clinicName: string;
    doctorEmail: string;
    createdAt: string;
    emailNotification?: { sent?: boolean; previewUrl?: string };
  } | null>(null);

  const fillSampleClinic = (preset: 'roha' | 'murud' | 'karjat') => {
    if (preset === 'roha') {
      setName('Roha Primary Health Centre');
      setType('PHC');
      setTaluka('Roha');
      setPinCode('402109');
      setAddress('Near Roha Bus Stand, Roha-Kolad Road, Raigad');
      setPhone('+91 2144 222120');
      setLatitude(18.4358);
      setLongitude(73.1197);
      setDoctorName('Dr. Kavita Verma');
      setDoctorEmail('kavita.verma@phc-roha.in');
      setDoctorPhone('+91 98231 44552');
      setPassword('Password@123');
    } else if (preset === 'murud') {
      setName('Murud Rural Hospital & CHC');
      setType('CHC');
      setTaluka('Murud');
      setPinCode('402401');
      setAddress('Coastal Highway, Near Murud Beach, Raigad');
      setPhone('+91 2144 274030');
      setLatitude(18.3283);
      setLongitude(72.9631);
      setDoctorName('Dr. Nilesh Gaikwad');
      setDoctorEmail('nilesh.gaikwad@chc-murud.in');
      setDoctorPhone('+91 98190 22314');
      setPassword('Password@123');
    } else {
      setName('Karjat Primary Health Centre');
      setType('PHC');
      setTaluka('Karjat');
      setPinCode('410201');
      setAddress('Station Road, Dahivali, Karjat, Raigad');
      setPhone('+91 2148 222015');
      setLatitude(18.9102);
      setLongitude(73.3283);
      setDoctorName('Dr. Sneha Kadam');
      setDoctorEmail('sneha.kadam@phc-karjat.in');
      setDoctorPhone('+91 98334 11209');
      setPassword('Password@123');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Please enter the clinic facility name.');
      return;
    }
    if (!phone.trim()) {
      setErrorMessage('Please enter the clinic emergency telephone.');
      return;
    }
    if (!doctorName.trim()) {
      setErrorMessage('Please enter the Lead Medical Officer name.');
      return;
    }
    if (!doctorEmail.trim() || !doctorEmail.includes('@')) {
      setErrorMessage('Please enter a valid official doctor email address.');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setErrorMessage('Secure access PIN/password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        type,
        districtName: districtName.trim(),
        taluka: taluka.trim(),
        pinCode: pinCode.trim(),
        address: address.trim(),
        phone: phone.trim(),
        latitude: Number(latitude) || 18.65,
        longitude: Number(longitude) || 73.0,
        doctorName: doctorName.trim(),
        doctorEmail: doctorEmail.toLowerCase().trim(),
        doctorPhone: doctorPhone.trim(),
        password,
      };

      const res = await api.post('/api/facilities/register', payload);

      setIsSubmitting(false);
      setRegisteredData({
        registrationId: res.registrationId || res.facility?.id || 'REG-PENDING',
        clinicName: name.trim(),
        doctorEmail: doctorEmail.toLowerCase().trim(),
        createdAt: new Date().toISOString(),
        emailNotification: res.emailNotification,
      });
    } catch (err) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'Registration failed.');
    }
  };

  return (
    <main className="min-h-screen bg-surface-container-low flex flex-col antialiased text-on-surface">
      {/* 1. Header Bar */}
      <header className="h-16 border-b border-slate-200 bg-surface-container-lowest px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/login')}
            className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-on-surface hover:bg-slate-100 transition-colors"
            title="Back to Sign-in"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Meditory" className="h-7 w-auto object-contain" />
            <div className="h-4 w-px bg-slate-300 hidden sm:block" />
            <span className="text-xs sm:text-sm font-semibold tracking-tight text-on-surface">
              Public Health Clinic Registration Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="http://localhost:3005"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-high border border-slate-200 text-xs font-semibold text-primary hover:bg-slate-100 transition-all shadow-xs"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>District Admin Portal</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </header>

      {/* 2. Body Container */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 sm:py-10">
        {registeredData ? (
          /* Success Screen */
          <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-lg p-8 sm:p-10 space-y-6 text-center animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600">
              <FileCheck2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100/70 border border-amber-200 text-amber-800 text-xs font-bold uppercase tracking-wide">
                Application Received • Pending Authority Approval
              </span>
              <h2 className="text-2xl font-bold text-on-surface">
                {registeredData.clinicName} Registered
              </h2>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                Your clinic registration reference is{' '}
                <strong className="font-mono text-primary font-bold">
                  {registeredData.registrationId}
                </strong>
                . The application has been routed to the District Health Authority for verification.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-5 max-w-lg mx-auto text-left space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500">Registration ID:</span>
                <span className="font-mono font-bold text-slate-800">
                  {registeredData.registrationId}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500">Facility Type:</span>
                <span className="font-semibold text-slate-800">{type} Facility</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500">Lead MOIC Login Email:</span>
                <span className="font-mono text-slate-800">{registeredData.doctorEmail}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Authorization Status:</span>
                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Awaiting District Approval
                </span>
              </div>
            </div>

            {/* Email Notification Dispatch Status */}
            <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200 text-xs text-left max-w-lg mx-auto flex items-start gap-3">
              <Mail className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="font-bold text-teal-900 block">
                  Official Confirmation Email Dispatched
                </strong>
                <p className="text-[11px] text-teal-800">
                  An application receipt has been sent to <strong>{registeredData.doctorEmail}</strong>. You will also receive an email notification the moment your clinic is approved by the District Authority.
                </p>
                {registeredData.emailNotification?.previewUrl && (
                  <a
                    href={registeredData.emailNotification.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-teal-900 font-bold underline mt-1"
                  >
                    <span>View Test Email in Web Mailbox →</span>
                  </a>
                )}
              </div>
            </div>

            {/* Admin Portal Demonstration Note */}
            <div className="p-4 rounded-lg bg-primary-container/10 border border-primary-container/20 text-xs text-left max-w-lg mx-auto flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-primary-container shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-on-surface block">
                  District Health Authority Review (Port 3005)
                </strong>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  To approve this registration and immediately initialize emergency shelf inventory, open the dedicated Admin Server on port 3005.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <a
                href="http://localhost:3005"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto h-11 px-6 rounded-lg bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary transition-all shadow-sm"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Open District Admin Portal to Approve</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => router.push('/login')}
                className="w-full sm:w-auto h-11 px-6 rounded-lg bg-surface-container-high hover:bg-slate-200 text-on-surface text-xs font-semibold flex items-center justify-center gap-2 transition-all border border-slate-200"
              >
                <span>Return to Dispensary Sign-in</span>
              </button>
            </div>
          </div>
        ) : (
          /* Registration Form */
          <div className="bg-surface-container-lowest rounded-xl border border-slate-200/80 shadow-xl overflow-hidden">
            {/* Top Accent Strip */}
            <div className="h-1.5 w-full bg-primary-container" />

            <div className="p-6 sm:p-9 space-y-6">
              {/* Form Title & Sample Fillers */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
                    Register New Public Health Clinic
                  </h1>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Onboard Primary Health Centres (PHC), Community Health Centres (CHC), or Sub-Centres to the district inventory grid
                  </p>
                </div>

                {/* Demo Presets for Speed */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-slate-500 font-semibold mr-1">Quick Fill:</span>
                  <button
                    type="button"
                    onClick={() => fillSampleClinic('roha')}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors"
                  >
                    Roha PHC
                  </button>
                  <button
                    type="button"
                    onClick={() => fillSampleClinic('murud')}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors"
                  >
                    Murud CHC
                  </button>
                  <button
                    type="button"
                    onClick={() => fillSampleClinic('karjat')}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors"
                  >
                    Karjat PHC
                  </button>
                </div>
              </div>

              {/* Error Box */}
              {errorMessage && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2.5 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-6">
                {/* SECTION 1: FACILITY DETAILS */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wide">
                    <Building2 className="w-4 h-4" />
                    <span>1. Clinic Facility Information</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Clinic Name */}
                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Official Clinic Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Roha Primary Health Centre"
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    {/* Facility Type */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Facility Tier *
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      >
                        <option value="PHC">Primary Health Centre (PHC)</option>
                        <option value="CHC">Community Health Centre (CHC)</option>
                        <option value="SUB_CENTRE">Sub-Health Centre (Sub-Center)</option>
                      </select>
                    </div>

                    {/* Clinic Phone */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Facility Landline / Emergency Phone *
                      </label>
                      <input
                        type="text"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 2144 222120"
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    {/* District & Taluka */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        District
                      </label>
                      <input
                        type="text"
                        required
                        value={districtName}
                        onChange={(e) => setDistrictName(e.target.value)}
                        placeholder="Raigad"
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Taluka / Block
                      </label>
                      <input
                        type="text"
                        value={taluka}
                        onChange={(e) => setTaluka(e.target.value)}
                        placeholder="e.g., Roha"
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    {/* Street Address */}
                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Street Address / Landmark
                      </label>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g., Near Roha Bus Stand, Roha-Kolad Road"
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    {/* GPS Coordinates */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Latitude (for Emergency Routing)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={latitude}
                        onChange={(e) => setLatitude(parseFloat(e.target.value))}
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Longitude (for Emergency Routing)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={longitude}
                        onChange={(e) => setLongitude(parseFloat(e.target.value))}
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>
                </div>

                {/* SECTION 2: MEDICAL OFFICER IN-CHARGE */}
                <div className="space-y-4 pt-4 border-t border-slate-200/60">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wide">
                    <Stethoscope className="w-4 h-4" />
                    <span>2. Medical Officer In-Charge (Lead Doctor Credentials)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Doctor Full Name */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Doctor Full Name (MOIC) *
                      </label>
                      <input
                        type="text"
                        required
                        value={doctorName}
                        onChange={(e) => setDoctorName(e.target.value)}
                        placeholder="e.g., Dr. Kavita Verma"
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    {/* Doctor Mobile */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Doctor Mobile Phone *
                      </label>
                      <input
                        type="text"
                        required
                        value={doctorPhone}
                        onChange={(e) => setDoctorPhone(e.target.value)}
                        placeholder="+91 98231 44552"
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    {/* Doctor Login Email */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Work Email (Dispensary Login ID) *
                      </label>
                      <input
                        type="email"
                        required
                        value={doctorEmail}
                        onChange={(e) => setDoctorEmail(e.target.value)}
                        placeholder="kavita.verma@phc-roha.in"
                        className="w-full h-10 px-3 rounded bg-surface-container-low border border-slate-200 text-sm font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>

                    {/* Password */}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Secure Shift PIN / Password *
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          className="w-full h-10 px-3 pr-10 rounded bg-surface-container-low border border-slate-200 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/60">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Clinic applications undergo District Authority verification before activation.</span>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => router.push('/login')}
                      className="w-full sm:w-auto h-11 px-5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full sm:w-auto h-11 px-7 rounded-lg bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary transition-all shadow-sm disabled:opacity-75"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting Registration...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Clinic Application</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
