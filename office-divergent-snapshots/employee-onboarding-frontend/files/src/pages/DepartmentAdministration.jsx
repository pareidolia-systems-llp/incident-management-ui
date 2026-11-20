import DepartmentMembershipManagement from '../components/DepartmentMembershipManagement'
import { departmentMembershipEnabled } from '../api/employees'
import DepartmentHeadManagement from '../components/DepartmentHeadManagement'
import DepartmentMailRecipients from '../components/DepartmentMailRecipients'
import PageTitle from '../components/PageTitle'
import useAuth from '../auth/useAuth'
import HandlerEligibilityManagement from '../components/HandlerEligibilityManagement'
import { DepartmentAdministrationGuide } from '../components/AdministrationGuides'

export default function DepartmentAdministration() {
  const { user } = useAuth()
  const personnel = user?.canManageEmployees === true && import.meta.env.VITE_DEPARTMENT_ADMIN_ENABLED === 'true'
  const membership = user?.canManageDepartmentMemberships === true && departmentMembershipEnabled()
  if (!personnel && !membership) return <div className="alert alert-danger" role="alert">Department administration is unavailable to your account. Ask the HR access administrator to check your permission.</div>
  return <><PageTitle title="Department administration" />
    {personnel && <details className="mb-3"><summary>How to use Department Administration</summary><DepartmentAdministrationGuide /></details>}
    {membership && <DepartmentMembershipManagement />}
    {personnel && <><DepartmentHeadManagement />
      {import.meta.env.VITE_DEPARTMENT_MAIL_RECIPIENTS_ENABLED === 'true' && <DepartmentMailRecipients />}
      <HandlerEligibilityManagement /></>}</>
}