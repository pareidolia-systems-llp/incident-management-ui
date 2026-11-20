// Development-only in-memory transport. Unknown requests fail locally.
export function createPreviewAdapter() {
  let version = 3
  let status = 'ASSIGNED'
  const incident = { id: 42, incidentNumber: 'INC-PREVIEW-0042', title: 'Synthetic software interruption',
    description: 'Example only: a fictional application is unavailable.', issueType: 'IT_ISSUE', category: 'APPLICATION',
    severity: 'MEDIUM', priority: 'MEDIUM', status, reportedBy: 'preview-user@example.test', reporterEmployeeId: 'SYNTHETIC-42',
    reporterDepartment: 'Synthetic Operations', affectedSystem: 'Example application', assignedOwner: 'Synthetic handler',
    createdAt: '2026-01-15T09:30:00', reportedAt: '2026-01-15T09:30:00' }
  const history = [{ id: 1, actionType: 'INCIDENT_CREATED', changedBy: 'Synthetic user', changedAt: '2026-01-15T09:30:00', newValue: incident.incidentNumber }]
  const attachments = []
  const response = (config, data, code = 200) => Promise.resolve({ data, status: code, statusText: 'OK', headers: {}, config })
  const deny = (config, code = 404) => Promise.reject(Object.assign(new Error('Unavailable in synthetic preview'), { config, response: { status: code, data: {} } }))
  return async config => {
    const method = (config.method || 'get').toLowerCase()
    const url = config.url
    if (method === 'get' && url === '/api/incidents/42') return response(config, { ...incident, status, incidentVersion: version })
    if (method === 'get' && url === '/api/incidents/42/history') return response(config, [...history].reverse())
    if (method === 'get' && url === '/api/incidents/42/attachments') return response(config, [...attachments])
    if (method === 'get' && /^\/api\/incidents\/42\/attachments\/\d+$/.test(url)) return response(config, new Blob(['Synthetic preview attachment'], { type: 'text/plain' }))
    if (method === 'get' && url === '/api/v2/incidents/42/metadata') return response(config, {
      id: 42, incidentVersion: version, classification: 'STANDARD', routingState: 'READY', status,
      responsibleDepartments: [{ id: 7, name: 'Synthetic IT' }], assignedHandler: { id: 9, name: 'Synthetic handler' },
      actions: { canClassify: false, canAssign: false, canInvestigate: ['ASSIGNED','IN_PROGRESS'].includes(status),
        canResolve: ['ASSIGNED','IN_PROGRESS'].includes(status), canValidate: status === 'RESOLVED',
        canRejectResolution: status === 'RESOLVED', canClose: status === 'VALIDATED',
        canUploadAttachment: true, canAddWorkNote: status !== 'CLOSED' },
    })
    if (method === 'post' && url.startsWith('/api/incidents/42/')) {
      const action = url.slice('/api/incidents/42/'.length)
      const body = config.data instanceof FormData ? config.data : typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
      const expected = body instanceof FormData ? Number(body.get('expectedVersion')) : body.expectedVersion
      if (expected !== version) return deny(config, 409)
      const labels = { investigation: 'INVESTIGATION_UPDATED', resolve: 'INCIDENT_RESOLVED', validate: 'INCIDENT_VALIDATED',
        'resolution-feedback': 'RESOLUTION_NOT_ACCEPTED', close: 'INCIDENT_CLOSED', 'work-notes': 'WORK_NOTE', attachments: 'ATTACHMENT_ADDED' }
      if (!Object.hasOwn(labels, action)) return deny(config)
      if (action === 'attachments') {
        const files = body.getAll('files')
        for (const file of files) attachments.push({ id: attachments.length + 1, originalFilename: file.name, fileSize: file.size, uploadedBy: 'Synthetic user', uploadedAt: new Date().toISOString() })
      }
      if (action === 'investigation') { Object.assign(incident, body); status = 'IN_PROGRESS' }
      if (action === 'resolve') { incident.resolutionDetails = body.resolutionDetails; status = 'RESOLVED' }
      if (action === 'validate') status = 'VALIDATED'
      if (action === 'resolution-feedback') status = 'IN_PROGRESS'
      if (action === 'close') status = 'CLOSED'
      version += 1
      history.push({ id: history.length + 1, actionType: labels[action], changedBy: 'Synthetic user', changedAt: new Date().toISOString(), remarks: body instanceof FormData ? 'Synthetic attachment added' : body.remarks || body.feedback || '' })
      return response(config, { ...incident, status, incidentVersion: version }, action === 'work-notes' || action === 'attachments' ? 201 : 200)
    }
    return deny(config)
  }
}
