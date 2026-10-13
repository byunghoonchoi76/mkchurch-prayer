import { LegalDocument } from '@/components/legal-document';
import { PRIVACY_POLICY } from '@/constants/legal';

/** 개인정보처리방침 */
export default function PrivacyScreen() {
  return <LegalDocument doc={PRIVACY_POLICY} />;
}
