import API from '../api/axios'

const API_ORIGIN = (API.defaults?.baseURL || '').replace(/\/api\/?$/, '')

export function buildPhotoUrl(photo) {
  if (!photo) return null
  if (/^https?:\/\//i.test(photo)) return photo
  const normalized = photo.startsWith('/') ? photo : `/${photo}`
  return `${API_ORIGIN}${normalized}`
}
