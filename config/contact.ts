export const contact = {
  CONTACT_NAME: 'CONTACT_NAME',
  CONTACT_EMAIL: 'CONTACT_EMAIL',
  CONTACT_PHONE: 'CONTACT_PHONE',
  CONTACT_WHATSAPP: 'CONTACT_WHATSAPP',
  CONTACT_INSTAGRAM: 'CONTACT_INSTAGRAM',
  CONTACT_LINKEDIN: 'CONTACT_LINKEDIN',
};
export const configured = (value: string) =>
  Boolean(value && !value.startsWith('CONTACT_'));
