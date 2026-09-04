import type { Profile } from '../types/profile'
import { fieldLabel, fieldValue } from '../utils/format'

export default function ProfileDetail({
  profile,
  onClose,
}: {
  profile: Profile
  onClose: () => void
}) {
  const entries = Object.entries(profile).filter(
    ([key, value]) =>
      key !== 'id' &&
      value !== '' &&
      value != null &&
      !(Array.isArray(value) && value.length === 0),
  )

  return (
    <section className="panel detail">
      <div className="detail-head">
        <h2>{fieldValue(profile.full_name) || `Profile ${profile.id}`}</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </div>
      <dl className="detail-grid">
        {entries.map(([key, value]) => (
          <div className="detail-item" key={key}>
            <dt>{fieldLabel(key)}</dt>
            <dd>{fieldValue(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}