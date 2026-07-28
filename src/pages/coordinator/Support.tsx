import UnifiedSupportPage from '../../components/support/UnifiedSupportPage';
import { coordinatorSupportConfig } from '../support/roleSupportConfigs';

export default function CoordinatorSupport() {
  return <UnifiedSupportPage config={coordinatorSupportConfig} />;
}
