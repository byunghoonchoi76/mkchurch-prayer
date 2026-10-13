import { LegalDocument } from '@/components/legal-document';
import { TERMS_OF_SERVICE } from '@/constants/legal';

/** 이용약관 */
export default function TermsScreen() {
  return <LegalDocument doc={TERMS_OF_SERVICE} />;
}
