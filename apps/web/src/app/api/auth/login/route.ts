import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        {
          error: 'ValidationError',
          message: 'Both Work Email / Staff ID and Password are required.',
          statusCode: 400,
        },
        { status: 400 }
      );
    }

    // Mock facility and worker profile
    const isAlibag = email.includes('alibag') || email.includes('STF-71092');

    const facility = isAlibag
      ? {
          id: 'PHC-ALIBAG-01',
          name: 'Alibag Primary Health Centre',
          districtId: 'DISTRICT-RAIGAD',
          districtName: 'Raigad',
          type: 'PHC' as const,
          phone: '+91 2141 222045',
          address: 'Near Civil Hospital, Rewas Road, Alibag, Raigad - 402201',
          latitude: 18.6414,
          longitude: 72.8722,
          createdAt: '2026-01-01T00:00:00.000Z',
        }
      : {
          id: 'PHC-SECTOR4-01',
          name: 'PHC Sector 4 — Dispensary Terminal A',
          districtId: 'DISTRICT-RAIGAD',
          districtName: 'Raigad',
          type: 'PHC' as const,
          phone: '+91 2141 223190',
          address: 'Sub-Centre & PHC Sector 4, Dispensary Wing, Alibag, Raigad - 402201',
          latitude: 18.6521,
          longitude: 72.8805,
          createdAt: '2026-01-01T00:00:00.000Z',
        };

    const worker = {
      id: isAlibag ? 'USR-ALIBAG-01' : 'STF-71092-PHC',
      facilityId: facility.id,
      name: isAlibag ? 'Dr. Rahul Sharma' : 'Anita Deshmukh (Staff Nurse)',
      email: email.trim(),
      role: 'facility_worker' as const,
      status: 'ACTIVE' as const,
      createdAt: '2026-01-01T00:00:00.000Z',
      lastLoginAt: new Date().toISOString(),
    };

    // Generate a valid mock JWT token structure (Header.Payload.Signature)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        userId: worker.id,
        facilityId: facility.id,
        facilityName: facility.name,
        name: worker.name,
        email: worker.email,
        role: 'facility_worker',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 43200, // 12-hour shift expiry
      })
    ).toString('base64url');
    const signature = Buffer.from('mock_signature_meditory_bharat_2026').toString('base64url');
    const mockJwt = `${header}.${payload}.${signature}`;

    return NextResponse.json({
      token: mockJwt,
      user: worker,
      facility,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'InternalError',
        message: 'Failed to process terminal sign-in.',
        statusCode: 500,
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
