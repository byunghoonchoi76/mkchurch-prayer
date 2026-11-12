import { LegalDocument } from '@/components/legal-document';
import { EMAIL_REFUSAL } from '@/constants/legal';

/** 이메일무단수집거부 */
export default function EmailRefusalScreen() {
  return <LegalDocument doc={EMAIL_REFUSAL} />;
}
