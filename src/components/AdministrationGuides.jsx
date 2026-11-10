import { reporterDepartments } from '../utils/incidentOptions'

export function EmployeeAdministrationGuide() {
  return <>
    <p>Authorized HR staff and IT administrators use Employee Management to maintain employee accounts. This permission gives no access to incident records.</p>
    <ul>
      <li>To add an employee, enter their employee ID, name and official company email, then choose <strong>Add Employee</strong>.</li>
      <li>To correct a name or employee ID, find the account, choose <strong>Edit</strong>, enter the reason and check the changes before confirming. The official email is read-only.</li>
      <li>To deactivate or reactivate an account, select the employee and use the account status action. Check the account and enter a reason before confirming.</li>
      <li>Open the employee’s history to see what changed, when and why.</li>
    </ul>
  </>
}

export function DepartmentAdministrationGuide() {
  return <>
    <p>The four organizational departments are {reporterDepartments.join(', ')}. IT is a separate team that handles service requests and IT issues.</p>
    <ul>
      <li><strong>Membership.</strong> Authorized HR staff record which employees belong to each department. If the Department memberships panel appears, select the department and employee, enter a reason, review the change and confirm.</li>
      <li><strong>Department heads.</strong> Authorized HR staff record or remove head designations. Heads may receive notices for incidents they are authorized to see. A designation alone gives no incident access.</li>
      <li><strong>Handler eligibility.</strong> An authorized administrator can mark an employee as eligible to handle cases. The portal also checks assignment scope and case permissions. Eligible IT service handlers can handle ordinary IT cases from any department when authorized for the case.</li>
      <li>Use each panel’s history to check who made a change and why.</li>
    </ul>
  </>
}
