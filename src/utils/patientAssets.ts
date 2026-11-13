export const DEFAULT_PATIENT_AVATAR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="#0F766E"/><circle cx="60" cy="46" r="20" fill="#CCFBF1"/><path d="M24 104c4-20 18-32 36-32s32 12 36 32" fill="#CCFBF1"/></svg>'
  );

export const DOCTOR_AVATAR =
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=150&auto=format&fit=crop&q=80';

export const PATIENT_IMAGE_MAP: Record<string, string> = {
  'PT-8021': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'PT-8022': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'PT-8023': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'PT-8024': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'PT-8025': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
  'PT-8026': 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80',
};

export function getPatientAvatar(patientId?: string, explicitUrl?: string): string {
  if (patientId && PATIENT_IMAGE_MAP[patientId]) {
    return PATIENT_IMAGE_MAP[patientId];
  }
  if (explicitUrl && explicitUrl.trim()) {
    return explicitUrl;
  }
  return DEFAULT_PATIENT_AVATAR;
}

export const EMERGENCY_WHATSAPP_PREFILL_MESSAGE =
  'YOUR WARD IS UNDER EMERGENCY SITUATION. PLEASE PAY ATTENTION TOWARDS YOUR WARD.';

export interface WhatsAppUrlResult {
  valid: boolean;
  phone: string;
  e164: string;
  url: string;
  error?: string;
}

export function validateAndNormalizeWhatsAppPhone(phone?: string): {
  valid: boolean;
  phone: string;
  e164: string;
  error?: string;
} {
  const raw = String(phone || '').trim();
  if (!raw) {
    return {
      valid: false,
      phone: '',
      e164: '',
      error: 'Emergency contact phone number is missing.'
    };
  }

  if (!/^[+\d\s().-]+$/.test(raw)) {
    return {
      valid: false,
      phone: '',
      e164: '',
      error: 'Phone number contains invalid characters. Use digits and an international dialing code (e.g. +919353802577 or +15558765432).'
    };
  }

  let normalizedDigits = '';

  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) {
      return {
        valid: false,
        phone: '',
        e164: '',
        error: 'Invalid international phone number. Include a valid country dialing code and 10 to 15 digits total.'
      };
    }
    if (digits.startsWith('0') || /^(\d)\1+$/.test(digits)) {
      return {
        valid: false,
        phone: '',
        e164: '',
        error: 'Invalid international dialing code. Country code cannot start with 0.'
      };
    }
    normalizedDigits = digits;
  } else {
    const digits = raw.replace(/\D/g, '');
    if (!digits || /^(\d)\1+$/.test(digits)) {
      return {
        valid: false,
        phone: '',
        e164: '',
        error: 'Please enter a valid emergency contact phone number.'
      };
    }

    if (digits.startsWith('00')) {
      const intlDigits = digits.slice(2);
      if (intlDigits.length < 10 || intlDigits.length > 15 || intlDigits.startsWith('0')) {
        return {
          valid: false,
          phone: '',
          e164: '',
          error: 'Invalid international dialing code after 00 prefix.'
        };
      }
      normalizedDigits = intlDigits;
    } else if (/^[6-9]\d{9}$/.test(digits)) {
      // Indian 10-digit mobile number without country code -> prepend 91
      normalizedDigits = `91${digits}`;
    } else if (/^91[6-9]\d{9}$/.test(digits)) {
      normalizedDigits = digits;
    } else if (/^1[2-9]\d{9}$/.test(digits)) {
      normalizedDigits = digits;
    } else {
      return {
        valid: false,
        phone: '',
        e164: '',
        error: 'Phone number must include a valid international dialing code (e.g. +919353802577 or +15558765432) or be a valid 10-digit Indian mobile number.'
      };
    }
  }

  return {
    valid: true,
    phone: normalizedDigits,
    e164: `+${normalizedDigits}`
  };
}

export function formatPhoneE164(phone?: string): string {
  if (!phone) return '';
  const checked = validateAndNormalizeWhatsAppPhone(phone);
  if (checked.valid) {
    return checked.e164;
  }
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) {
    return '+' + trimmed.slice(1).replace(/\D/g, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  return digits ? `+${digits}` : trimmed;
}

export function formatTelLink(phone?: string): string {
  const normalized = formatPhoneE164(phone);
  return normalized ? `tel:${normalized}` : '#';
}

export function buildEmergencyWhatsAppUrl(
  phone?: string,
  messageText: string = EMERGENCY_WHATSAPP_PREFILL_MESSAGE
): WhatsAppUrlResult {
  const checked = validateAndNormalizeWhatsAppPhone(phone);
  if (!checked.valid) {
    return {
      valid: false,
      phone: '',
      e164: '',
      url: '#',
      error: checked.error
    };
  }

  const message =
    messageText && messageText.trim()
      ? messageText
      : EMERGENCY_WHATSAPP_PREFILL_MESSAGE;
  const whatsappURL = `https://wa.me/${checked.phone}?text=${encodeURIComponent(message)}`;

  return {
    valid: true,
    phone: checked.phone,
    e164: checked.e164,
    url: whatsappURL
  };
}

export function formatWhatsAppLink(
  phone?: string,
  messageText: string = EMERGENCY_WHATSAPP_PREFILL_MESSAGE
): string {
  const result = buildEmergencyWhatsAppUrl(phone, messageText);
  return result.valid ? result.url : '#';
}

export function isValidEmail(email?: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validatePhoneInput(phone?: string): { valid: boolean; normalized: string; error?: string } {
  const checked = validateAndNormalizeWhatsAppPhone(phone);
  if (!checked.valid) {
    return {
      valid: false,
      normalized: '',
      error: checked.error
    };
  }
  return { valid: true, normalized: checked.e164 };
}

export function isValidSyntheaPatientIdFormat(patientId?: string): boolean {
  if (!patientId) return false;
  return /^PT-\d{4,}$/i.test(patientId.trim());
}

export function maskPhoneNumber(phone?: string): string {
  if (!phone) return 'Unavailable';
  const normalized = formatPhoneE164(phone);
  const digits = normalized.replace(/\D/g, '');
  if (digits.length <= 4) {
    return '••••';
  }
  const last4 = digits.slice(-4);
  if (normalized.startsWith('+')) {
    const prefixLen = digits.length >= 12 ? 3 : 2;
    const prefix = normalized.slice(0, prefixLen);
    const maskedCount = Math.max(4, normalized.length - prefixLen - 4);
    return `${prefix} ${'•'.repeat(maskedCount)}${last4}`;
  }
  return `${'•'.repeat(Math.max(4, digits.length - 4))}${last4}`;
}


