import { Link } from 'react-router-dom'
import { helpFieldLinks } from '../utils/portalHelp'
import { fieldGuidance, remarksGuidance } from '../utils/incidentGuidance'

export default function FieldGuidance({ name, id, label, actionKey }) {
  const guidance = (actionKey === 'resolutionFeedback' && name === 'evidenceReference' && fieldGuidance.resolutionFeedbackEvidence) || (name === 'remarks' && remarksGuidance[actionKey]) || fieldGuidance[name]
  if (!guidance) return null

  return <div className="form-text">
    <div id={`${id}-help`}>{guidance.text}</div>
    {guidance.example && <details className="mt-1">
      <summary>Example<span className="visually-hidden"> for {label}</span></summary>
      <div className="mt-1">{guidance.example}</div>
    </details>}
    {helpFieldLinks[name] && <Link aria-label={`Learn more about ${label}`} className="d-inline-block mt-1" to={`/help#${helpFieldLinks[name]}`}>Learn more<span className="visually-hidden"> about {label}</span></Link>}
  </div>
}
