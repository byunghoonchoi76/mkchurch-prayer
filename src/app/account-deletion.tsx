import { LegalDocument } from '@/components/legal-document';
import { ACCOUNT_DELETION } from '@/constants/legal';

/** 계정 삭제 요청 안내 */
export default function AccountDeletionScreen() {
  return <LegalDocument doc={ACCOUNT_DELETION} />;
}
