/**
 * Institution-specific values. Edit these to match your campus — nothing
 * else in the app hardcodes them.
 */

export const UNIVERSITY_NAME = 'Holy Angel University'
export const UNIVERSITY_SHORT = 'HAU'
export const LIBRARY_NAME = 'University Library'

/** HAU requires a group of at least this many to reserve a discussion room. */
export const MIN_GROUP_SIZE = 5

/** One photo of a student ID per member, so the count follows group size. */
export const ID_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const ID_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']

export const YEAR_LEVELS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
  'Graduate',
]

/**
 * Programs offered, grouped by school. Add or remove freely — the sign-up
 * form renders whatever is listed here, plus an "Other" escape hatch.
 */
export const COURSES = [
  {
    school: 'School of Computing',
    programs: [
      'BS Computer Science',
      'BS Information Technology',
      'BS Information Systems',
      'BS Entertainment and Multimedia Computing',
    ],
  },
  {
    school: 'School of Engineering and Architecture',
    programs: [
      'BS Architecture',
      'BS Civil Engineering',
      'BS Computer Engineering',
      'BS Electrical Engineering',
      'BS Electronics Engineering',
      'BS Industrial Engineering',
      'BS Mechanical Engineering',
    ],
  },
  {
    school: 'School of Business and Accountancy',
    programs: [
      'BS Accountancy',
      'BS Accounting Information System',
      'BS Business Administration',
      'BS Entrepreneurship',
      'BS Management Accounting',
      'BS Real Estate Management',
    ],
  },
  {
    school: 'School of Arts and Sciences',
    programs: [
      'AB Communication',
      'AB Political Science',
      'AB Psychology',
      'BS Biology',
      'BS Psychology',
    ],
  },
  {
    school: 'School of Education',
    programs: [
      'Bachelor of Elementary Education',
      'Bachelor of Secondary Education',
      'Bachelor of Physical Education',
      'Bachelor of Early Childhood Education',
    ],
  },
  {
    school: 'School of Health Sciences',
    programs: ['BS Nursing', 'BS Medical Technology', 'BS Pharmacy', 'BS Psychology (Clinical)'],
  },
  {
    school: 'School of Hospitality and Tourism Management',
    programs: ['BS Hospitality Management', 'BS Tourism Management'],
  },
  {
    school: 'School of Criminology',
    programs: ['BS Criminology'],
  },
]

export const OTHER_COURSE = 'Other'

/** "Dela Cruz, Juan M." — the form used everywhere a name is displayed. */
export function formatFullName({ lastName, firstName, middleInitial }) {
  const last = (lastName ?? '').trim()
  const first = (firstName ?? '').trim()
  const middle = (middleInitial ?? '').trim().replace(/\.$/, '')

  if (!last && !first) return ''
  const suffix = middle ? ` ${middle.toUpperCase()}.` : ''
  return `${last}, ${first}${suffix}`
}
