'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Session } from 'next-auth'
import CalendarSelector from '@/components/CalendarSelector'

interface ExtendedSession extends Session {
  accessToken?: string
}

interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  location?: string
  htmlLink: string
  calendarId?: string
  backgroundColor?: string
  foregroundColor?: string
}

export default function CalendarPage() {
  const { data: session, status } = useSession()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedJobs, setCompletedJobs] = useState<Set<string>>(new Set())
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
  const [startDate, setStartDate] = useState<string>(() => {
    // Default to today's date in YYYY-MM-DD format
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/')
    }
  }, [status])

  useEffect(() => {
    if ((session as ExtendedSession)?.accessToken) {
      fetchCalendarEvents()
    }
  }, [session, startDate, selectedCalendarId]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCalendarEvents = async () => {
    try {
      setLoading(true)
      
      if (selectedCalendarId === 'all') {
        // Fetch from all calendars
        const calendarsResponse = await fetch('/api/calendar/calendars')
        if (!calendarsResponse.ok) {
          throw new Error('Failed to fetch calendars list')
        }
        const calendarsData = await calendarsResponse.json()
        const calendars = calendarsData.calendars || []
        
        // Fetch events from each calendar
        const allEvents: CalendarEvent[] = []
        for (const calendar of calendars) {
          try {
            const url = `/api/calendar/events?startDate=${startDate}&calendarId=${encodeURIComponent(calendar.id)}`
            const response = await fetch(url)
            if (response.ok) {
              const data = await response.json()
              allEvents.push(...(data.events || []))
            }
          } catch (err) {
            console.warn(`Failed to fetch events from calendar ${calendar.summary}:`, err)
          }
        }
        
        // Filter out "Need to book" events and sort by start time
        const filteredEvents = allEvents
          .filter((event: CalendarEvent) => 
            !event.summary || !event.summary.toLowerCase().includes('need to book')
          )
          .sort((a, b) => {
            const timeA = a.start.dateTime || a.start.date || ''
            const timeB = b.start.dateTime || b.start.date || ''
            return new Date(timeA).getTime() - new Date(timeB).getTime()
          })
        
        setEvents(filteredEvents)
      } else {
        // Fetch from specific calendar
        const url = `/api/calendar/events?startDate=${startDate}&calendarId=${encodeURIComponent(selectedCalendarId)}`
        const response = await fetch(url)
        
        if (!response.ok) {
          const errorData = await response.json()
          if (response.status === 401) {
            throw new Error('Please sign out and sign in again to grant calendar permissions')
          }
          throw new Error(errorData.details || errorData.error || 'Failed to fetch calendar events')
        }
        
        const data = await response.json()
        // Filter out "Need to book" events from the main calendar view
        const filteredEvents = (data.events || []).filter((event: CalendarEvent) => 
          !event.summary || !event.summary.toLowerCase().includes('need to book')
        )
        setEvents(filteredEvents)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatEventDate = (event: CalendarEvent) => {
    const startDate = event.start.dateTime || event.start.date
    const endDate = event.end.dateTime || event.end.date
    
    if (!startDate) return 'No date'
    
    const start = new Date(startDate)
    const end = new Date(endDate || startDate)
    
    const isAllDay = !event.start.dateTime
    
    if (isAllDay) {
      return start.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
    
    const isSameDay = start.toDateString() === end.toDateString()
    
    if (isSameDay) {
      return `${start.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })} • ${start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })} - ${end.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })}`
    }
    
    return `${start.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })} ${start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })} - ${end.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })} ${end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`
  }

  const groupEventsByDate = (events: CalendarEvent[]) => {
    const grouped: { [key: string]: CalendarEvent[] } = {}
    
    events.forEach(event => {
      const startDate = event.start.dateTime || event.start.date
      if (!startDate) return
      
      const date = new Date(startDate)
      const dateKey = date.toDateString()
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(event)
    })
    
    return grouped
  }

  const openGoogleMapsRoute = (destination: string) => {
    // Get user's current location and open Google Maps with directions
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const origin = `${latitude},${longitude}`
          const encodedDestination = encodeURIComponent(destination)
          const mapsUrl = `https://www.google.com/maps/dir/${origin}/${encodedDestination}`
          window.open(mapsUrl, '_blank')
        },
        (error) => {
          console.error('Error getting location:', error)
          // Fallback: open Google Maps with just the destination
          const encodedDestination = encodeURIComponent(destination)
          const mapsUrl = `https://www.google.com/maps/search/${encodedDestination}`
          window.open(mapsUrl, '_blank')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      )
    } else {
      // Geolocation not supported, fallback to search
      const encodedDestination = encodeURIComponent(destination)
      const mapsUrl = `https://www.google.com/maps/search/${encodedDestination}`
      window.open(mapsUrl, '_blank')
    }
  }

  const routeAllForDay = (dateEvents: CalendarEvent[]) => {
    // Filter events that have locations
    const eventsWithLocations = dateEvents.filter(event => event.location && event.location.trim() !== '')
    
    if (eventsWithLocations.length === 0) {
      alert('No events with locations found for this day.')
      return
    }

    if (eventsWithLocations.length === 1) {
      // If only one location, just open regular directions
      openGoogleMapsRoute(eventsWithLocations[0].location!)
      return
    }

    // Get user's current location first
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          const origin = `${latitude},${longitude}`
          
          // Sort events by time to create a logical route order
          const sortedEvents = eventsWithLocations.sort((a, b) => {
            const timeA = a.start.dateTime || a.start.date || ''
            const timeB = b.start.dateTime || b.start.date || ''
            return new Date(timeA).getTime() - new Date(timeB).getTime()
          })
          
          // Create waypoints from all locations except the last one
          const waypoints = sortedEvents.slice(0, -1).map(event => 
            encodeURIComponent(event.location!)
          ).join('/')
          
          // Last location becomes the destination
          const destination = encodeURIComponent(sortedEvents[sortedEvents.length - 1].location!)
          
          // Construct Google Maps URL for multi-stop route
          const mapsUrl = `https://www.google.com/maps/dir/${origin}/${waypoints}/${destination}`
          window.open(mapsUrl, '_blank')
        },
        (error) => {
          console.error('Error getting location:', error)
          // Fallback: create route without current location
          routeAllWithoutLocation(eventsWithLocations)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      )
    } else {
      // Geolocation not supported, create route without current location
      routeAllWithoutLocation(eventsWithLocations)
    }
  }

  const routeAllWithoutLocation = (eventsWithLocations: CalendarEvent[]) => {
    // Sort events by time to create a logical route order
    const sortedEvents = eventsWithLocations.sort((a, b) => {
      const timeA = a.start.dateTime || a.start.date || ''
      const timeB = b.start.dateTime || b.start.date || ''
      return new Date(timeA).getTime() - new Date(timeB).getTime()
    })
    
    if (sortedEvents.length === 1) {
      // Single location, just search for it
      const encodedLocation = encodeURIComponent(sortedEvents[0].location!)
      const mapsUrl = `https://www.google.com/maps/search/${encodedLocation}`
      window.open(mapsUrl, '_blank')
      return
    }
    
    // First location as origin
    const origin = encodeURIComponent(sortedEvents[0].location!)
    
    // Create waypoints from middle locations
    const waypoints = sortedEvents.slice(1, -1).map(event => 
      encodeURIComponent(event.location!)
    ).join('/')
    
    // Last location as destination
    const destination = encodeURIComponent(sortedEvents[sortedEvents.length - 1].location!)
    
    // Construct Google Maps URL
    let mapsUrl = `https://www.google.com/maps/dir/${origin}/`
    if (waypoints) {
      mapsUrl += `${waypoints}/`
    }
    mapsUrl += destination
    
    window.open(mapsUrl, '_blank')
  }

  const openInGoogleCalendar = (event: CalendarEvent) => {
    // Open the event directly in Google Calendar using the htmlLink
    // This will automatically handle mobile app vs desktop browser
    window.open(event.htmlLink, '_blank', 'noopener,noreferrer')
  }

  const toggleJobCompletion = (eventId: string) => {
    setCompletedJobs((prev: Set<string>) => {
      const newSet = new Set(prev)
      if (newSet.has(eventId)) {
        newSet.delete(eventId)
      } else {
        newSet.add(eventId)
      }
      return newSet
    })
  }

  const getWeekDates = (startDate: string) => {
    const start = new Date(startDate)
    const weekDates = []
    
    // Get the start of the week (Sunday)
    const startOfWeek = new Date(start)
    startOfWeek.setDate(start.getDate() - start.getDay())
    
    // Generate 7 days starting from Sunday
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      weekDates.push(date)
    }
    
    return weekDates
  }

  const getEventsForDate = (date: Date) => {
    const dateString = date.toDateString()
    return events.filter((event: CalendarEvent) => {
      const eventDate = new Date(event.start.dateTime || event.start.date || '')
      return eventDate.toDateString() === dateString
    })
  }

  const formatTime = (dateTime: string) => {
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const getTimeRangeForWeek = (weekDates: Date[]) => {
    let earliestHour = 24
    let latestHour = 0
    
    weekDates.forEach(date => {
      const dateEvents = getEventsForDate(date)
      dateEvents.forEach((event: CalendarEvent) => {
        if (event.start.dateTime) {
          const eventHour = new Date(event.start.dateTime).getHours()
          earliestHour = Math.min(earliestHour, eventHour)
          latestHour = Math.max(latestHour, eventHour)
        }
      })
    })
    
    // If no events found, default to 8 AM - 6 PM
    if (earliestHour === 24 && latestHour === 0) {
      earliestHour = 8
      latestHour = 18
    }
    
    // Start 2 hours before earliest, end 3 hours after latest
    const startHour = Math.max(0, earliestHour - 2)
    const endHour = Math.min(23, latestHour + 3)
    
    return { startHour, endHour, totalHours: endHour - startHour + 1 }
  }

  const renderCalendarView = () => {
    const weekDates = getWeekDates(startDate)
    const { startHour, totalHours } = getTimeRangeForWeek(weekDates)
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Week header */}
        <div className="grid grid-cols-8 border-b border-gray-200 dark:border-gray-700">
          <div className="p-3 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Time</div>
          </div>
          {weekDates.map((date, index) => (
            <div key={index} className={`p-3 border-r border-gray-200 dark:border-gray-700 ${index === 6 ? 'border-r-0' : ''} ${isToday(date) ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
              <div className="text-center">
                <div className={`text-sm font-semibold ${isToday(date) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className={`text-lg font-bold ${isToday(date) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                  {date.getDate()}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Time slots */}
        <div className="grid grid-cols-8">
          {/* Time column */}
          <div className="border-r border-gray-200 dark:border-gray-700">
            {Array.from({ length: totalHours }, (_, index) => {
              const hour = startHour + index
              return (
                <div key={hour} className="h-16 border-b border-gray-100 dark:border-gray-600 flex items-center justify-end pr-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Day columns */}
          {weekDates.map((date, dayIndex) => (
            <div key={dayIndex} className={`border-r border-gray-200 dark:border-gray-700 ${dayIndex === 6 ? 'border-r-0' : ''}`}>
              {Array.from({ length: totalHours }, (_, index) => {
                const hour = startHour + index
                const hourEvents = getEventsForDate(date).filter(event => {
                  if (!event.start.dateTime) return false
                  const eventHour = new Date(event.start.dateTime).getHours()
                  return eventHour === hour
                })

                return (
                  <div key={hour} className="h-16 border-b border-gray-100 dark:border-gray-600 relative">
                    {hourEvents.map((event: CalendarEvent, eventIndex) => {
                      const startTime = new Date(event.start.dateTime!)
                      const endTime = new Date(event.end.dateTime || event.start.dateTime!)
                      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60) // hours
                      const topOffset = (startTime.getMinutes() / 60) * 64 // 64px = 1 hour height
                      const height = Math.max(duration * 64, 20) // minimum height of 20px

                      return (
                        <div
                          key={event.id}
                          className="absolute left-1 right-1 rounded px-2 py-1 text-xs text-white overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                          style={{
                            top: `${topOffset}px`,
                            height: `${height}px`,
                            backgroundColor: event.backgroundColor || '#4285f4',
                            zIndex: eventIndex + 1
                          }}
                          onClick={() => openInGoogleCalendar(event)}
                          title={`${event.summary} - ${formatTime(event.start.dateTime!)}`}
                        >
                          <div className="font-medium truncate">{event.summary}</div>
                          {height > 30 && (
                            <div className="text-xs opacity-90 truncate">
                              {formatTime(event.start.dateTime!)} - {formatTime(event.end.dateTime || event.start.dateTime!)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const groupedEvents = groupEventsByDate(events)
  const sortedDateKeys = Object.keys(groupedEvents).sort((a, b) => 
    new Date(a).getTime() - new Date(b).getTime()
  )

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-0">
              My Calendar
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <CalendarSelector
                selectedCalendarId={selectedCalendarId}
                onCalendarChange={setSelectedCalendarId}
              />
              <div className="flex items-center space-x-2">
                <label htmlFor="start-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Start from:
                </label>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center space-x-2 mb-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              View Mode:
            </label>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                📋 List View
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                📅 Calendar View
              </button>
            </div>
          </div>
          
          <p className="text-gray-600 dark:text-gray-400">
            Your inspections and bookings from {new Date(startDate).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })} onwards
          </p>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading calendar events...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error loading calendar
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={fetchCalendarEvents}
                    className="bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-800 dark:text-red-200 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No events found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              You don&apos;t have any events from {new Date(startDate).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })} onwards.
            </p>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div className="space-y-6">
            {viewMode === 'list' ? (
              // List View (existing functionality)
              sortedDateKeys.map(dateKey => {
                const date = new Date(dateKey)
                const dateEvents = groupedEvents[dateKey]
                
                return (
                  <div key={dateKey} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </h2>
                        <button
                          onClick={() => routeAllForDay(dateEvents)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                        >
                          Route All
                        </button>
                      </div>
                    </div>
                    <div className="divide-y divide-gray-200 dark:divide-gray-700">
                      {dateEvents.map(event => (
                        <div key={event.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <div className="flex items-start space-x-3">
                            <div 
                              className="flex-shrink-0 w-2 h-2 rounded-full mt-2"
                              style={{ 
                                backgroundColor: event.backgroundColor || '#4285f4' // Default Google Calendar blue
                              }}
                              title={`Calendar: ${event.calendarId || 'Primary'}`}
                            ></div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex-1">
                                  <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {event.summary || 'Untitled Event'}
                                  </h3>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {formatEventDate(event)}
                                  </p>
                                  {event.location && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      {event.location}
                                    </p>
                                  )}
                                  {event.description && (
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                                      {event.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2 mt-3 sm:mt-0 sm:ml-4">
                                  <button
                                    onClick={() => openInGoogleCalendar(event)}
                                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 002 2z" />
                                    </svg>
                                    <span>View in Calendar</span>
                                  </button>
                                  {event.location && (
                                    <>
                                      <button
                                        onClick={() => openGoogleMapsRoute(event.location!)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span>Get Directions</span>
                                      </button>
                                      <button
                                        onClick={() => toggleJobCompletion(event.id)}
                                        className={`${
                                          completedJobs.has(event.id)
                                            ? 'bg-green-500 hover:bg-green-600'
                                            : 'bg-gray-400 hover:bg-gray-500'
                                        } text-white px-2 py-1 rounded text-xs font-medium transition-colors flex items-center`}
                                        title={completedJobs.has(event.id) ? 'Job completed' : 'Mark as completed'}
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            ) : (
              // Calendar View
              renderCalendarView()
            )}
          </div>
        )}
      </div>
    </div>
  )
}
