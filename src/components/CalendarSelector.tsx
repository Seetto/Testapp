'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Session } from 'next-auth'

interface ExtendedSession extends Session {
  accessToken?: string
}

interface Calendar {
  id: string
  summary: string
  description?: string
  primary?: boolean
  accessRole: string
  backgroundColor?: string
  foregroundColor?: string
}

interface CalendarSelectorProps {
  selectedCalendarId: string
  onCalendarChange: (calendarId: string) => void
  className?: string
}

export default function CalendarSelector({ 
  selectedCalendarId, 
  onCalendarChange, 
  className = '' 
}: CalendarSelectorProps) {
  const { data: session } = useSession()
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if ((session as ExtendedSession)?.accessToken) {
      fetchCalendars()
    }
  }, [session])

  const fetchCalendars = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/calendar/calendars')
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || 'Failed to fetch calendars')
      }
      
      const data = await response.json()
      setCalendars(data.calendars || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Error fetching calendars:', err)
    } finally {
      setLoading(false)
    }
  }

  const getCalendarDisplayName = (calendar: Calendar) => {
    if (calendar.primary) {
      return `${calendar.summary} (Primary)`
    }
    return calendar.summary
  }

  const getAccessRoleIcon = (accessRole: string) => {
    switch (accessRole) {
      case 'owner':
        return '👑'
      case 'writer':
        return '✏️'
      case 'reader':
        return '👁️'
      default:
        return '📅'
    }
  }



  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Calendar:
        </label>
        <div className="w-48 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
          Loading...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Calendar:
        </label>
        <div className="w-48 px-3 py-2 text-sm border border-red-300 dark:border-red-600 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
          Error loading calendars
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <label htmlFor="calendar-selector" className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Calendar:
      </label>
      <select
        id="calendar-selector"
        value={selectedCalendarId}
        onChange={(e) => onCalendarChange(e.target.value)}
        className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[12rem]"
      >
        {/* ALL option */}
        <option value="all">📅 All Calendars</option>
        
        {/* Primary calendar first */}
        {calendars
          .filter(cal => cal.primary)
          .map(calendar => (
            <option key={calendar.id} value={calendar.id}>
              {getAccessRoleIcon(calendar.accessRole)} {getCalendarDisplayName(calendar)}
            </option>
          ))}
        
        {/* Other calendars */}
        {calendars
          .filter(cal => !cal.primary)
          .sort((a, b) => a.summary.localeCompare(b.summary))
          .map(calendar => (
            <option key={calendar.id} value={calendar.id}>
              {getAccessRoleIcon(calendar.accessRole)} {getCalendarDisplayName(calendar)}
            </option>
          ))}
      </select>
      
      {/* Calendar count indicator */}
      {calendars.length > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          ({calendars.length} calendar{calendars.length !== 1 ? 's' : ''})
        </span>
      )}
    </div>
  )
}
