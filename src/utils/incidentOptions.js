export const issueTypes = ['IT_ISSUE', 'SERVICE_REQUEST', 'SUSPECTED_SECURITY_INCIDENT', 'INFORMATION_SECURITY_INCIDENT', 'MAJOR_CRITICAL_SECURITY_INCIDENT']
export const reporterDepartments = ['Operations (Annotation)', 'Operations (Perioperative Flow Analysis)', 'HR', 'R&D']
export const issueTypeGuide = {
  IT_ISSUE: { meaning: 'Something in an application, device, network, or IT service is not working as expected.', example: 'VPN disconnecting or a workstation unable to connect to Wi-Fi.' },
  SERVICE_REQUEST: { meaning: 'A request for access, setup, installation, or another routine IT service rather than a fault.', example: 'Requesting access to an internal application or requesting software installation.' },
  SUSPECTED_SECURITY_INCIDENT: { meaning: 'Something appears suspicious but has not yet been confirmed as an information-security incident.', example: 'Unexpected MFA prompts or a suspicious email received by an employee.' },
  INFORMATION_SECURITY_INCIDENT: { meaning: 'A confirmed security event affecting information, systems, accounts, or access.', example: 'Confirmed unauthorized access to a company account.' },
  MAJOR_CRITICAL_SECURITY_INCIDENT: { meaning: 'A serious security incident with significant or widespread impact that requires urgent attention.', example: 'Major data exposure or widespread service disruption caused by a cyberattack.' },
}
export const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
export const categoriesByIssueType = {
  IT_ISSUE: ['Network / Connectivity', 'Account / Access', 'Hardware', 'Software / Application', 'Email / Collaboration', 'Device / Peripheral', 'Other'],
  SERVICE_REQUEST: ['Account / Access Request', 'Software Installation', 'Hardware Request', 'Permission / Access Change', 'General IT Request', 'Other'],
  SUSPECTED_SECURITY_INCIDENT: ['Phishing / Suspicious Email', 'Suspicious Login / Account Activity', 'Malware / Suspicious File', 'Unauthorized Access', 'Data Leakage / Exposure', 'Lost / Stolen Device', 'Other'],
  INFORMATION_SECURITY_INCIDENT: ['Account Compromise', 'Malware', 'Unauthorized Access', 'Data Breach / Exposure', 'Policy Violation', 'Security Control Failure', 'Other'],
  MAJOR_CRITICAL_SECURITY_INCIDENT: ['Ransomware', 'Major Data Breach', 'Critical System Compromise', 'Privileged Account Compromise', 'Widespread Malware', 'Major Service / Security Outage', 'Other'],
}
