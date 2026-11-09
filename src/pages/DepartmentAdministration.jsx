import DepartmentHeadManagement from '../components/DepartmentHeadManagement'
import PageTitle from '../components/PageTitle'
import useAuth from '../auth/useAuth'
import HandlerEligibilityManagement from '../components/HandlerEligibilityManagement'

export default function DepartmentAdministration() {
  const { user } = useAuth()
  if (user?.canManageEmployees !== true) return <div className="alert alert-danger" role="alert">Access denied.</div>
  return <><PageTitle title="Department administration" /><DepartmentHeadManagement /><HandlerEligibilityManagement /></>
}
