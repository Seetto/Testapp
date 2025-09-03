'use client'

import { useState, useEffect, useCallback } from 'react'
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

interface NearbyJobsResponse {
  needToBookEvents: CalendarEvent[]
  nearbyJobsByDay: {
    [date: string]: {
      needToBookEvent: CalendarEvent
      nearbyJobs: Array<{
        event: CalendarEvent
        distance: number
      }>
    }
  }
  warning?: string
}

export default function NeedToBookPage() {
  const { data: session, status } = useSession()
  const [data, setData] = useState<NearbyJobsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar')
  const [showNearbyJobs, setShowNearbyJobs] = useState(true)
  const [selectedNeedToBookEvent, setSelectedNeedToBookEvent] = useState<string>('')
  const [calendarColors, setCalendarColors] = useState<{ [key: string]: string }>({})
  const [calendarNames, setCalendarNames] = useState<{ [key: string]: string }>({})

  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirect('/')
    }
  }, [status])

  const fetchNeedToBookEvents = useCallback(async () => {
    try {
      setLoading(true)
      
      if (selectedCalendarId === 'all') {
        const calendarsResponse = await fetch('/api/calendar/calendars')
        if (!calendarsResponse.ok) {
          throw new Error('Failed to fetch calendars list')
        }
        const calendarsData = await calendarsResponse.json()
        const calendars = calendarsData.calendars || []
        
        const allNeedToBookEvents: CalendarEvent[] = []
        const allNearbyJobsByDay: { [date: string]: { needToBookEvent: CalendarEvent, nearbyJobs: Array<{ event: CalendarEvent, distance: number }> } } = {}
        const warnings: string[] = []
        
        for (const calendar of calendars) {
          try {
            const url = `/api/calendar/need-to-book?startDate=${startDate}&calendarId=${encodeURIComponent(calendar.id)}`
            const response = await fetch(url)
            if (response.ok) {
              const responseData = await response.json()
              allNeedToBookEvents.push(...(responseData.needToBookEvents || []))
              Object.assign(allNearbyJobsByDay, responseData.nearbyJobsByDay || {})
              if (responseData.warning) {
                warnings.push(`${calendar.summary}: ${responseData.warning}`)
              }
            }
          } catch (err) {
            console.warn(`Failed to fetch need-to-book events from calendar ${calendar.summary}:`, err)
          }
        }
        
        allNeedToBookEvents.sort((a, b) => {
          const timeA = a.start.dateTime || a.start.date || ''
          const timeB = b.start.dateTime || b.start.date || ''
          return new Date(timeA).getTime() - new Date(timeB).getTime()
        })
        
        setData({
          needToBookEvents: allNeedToBookEvents,
          nearbyJobsByDay: allNearbyJobsByDay,
          warning: warnings.length > 0 ? warnings.join('; ') : undefined
        })
      } else {
        const url = `/api/calendar/need-to-book?startDate=${startDate}&calendarId=${encodeURIComponent(selectedCalendarId)}`
        const response = await fetch(url)
        
        if (!response.ok) {
          const errorData = await response.json()
          if (response.status === 401) {
            throw new Error('Please sign out and sign in again to grant calendar permissions')
          }
          throw new Error(errorData.details || errorData.error || 'Failed to fetch events')
        }
        
        const responseData = await response.json()
        setData(responseData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [startDate, selectedCalendarId])

  const fetchCalendarColors = async () => {
    try {
      const calendarsResponse = await fetch('/api/calendar/calendars')
      if (calendarsResponse.ok) {
        const calendarsData = await calendarsResponse.json()
        const colors: { [key: string]: string } = {}
        const calendarNames: { [key: string]: string } = {}
        calendarsData.calendars?.forEach((calendar: { id: string; summary: string; backgroundColor?: string }) => {
          colors[calendar.id] = calendar.backgroundColor || '#4285f4'
          calendarNames[calendar.id] = calendar.summary
        })
        setCalendarColors(colors)
        setCalendarNames(calendarNames)
      }
    } catch (err) {
      console.warn('Failed to fetch calendar colors:', err)
    }
  }

  useEffect(() => {
    if ((session as ExtendedSession)?.accessToken) {
      fetchNeedToBookEvents()
      fetchCalendarColors()
    }
  }, [session, startDate, selectedCalendarId, fetchNeedToBookEvents])



  // Clear selection when nearby jobs checkbox is unchecked
  useEffect(() => {
    if (!showNearbyJobs) {
      setSelectedNeedToBookEvent('')
    }
  }, [showNearbyJobs])

  // Auto-select the first need-to-book event when data is loaded and nearby jobs are shown
  useEffect(() => {
    if (data && data.needToBookEvents.length > 0 && !selectedNeedToBookEvent && showNearbyJobs) {
      setSelectedNeedToBookEvent(data.needToBookEvents[0].id)
    }
  }, [data, selectedNeedToBookEvent, showNearbyJobs])

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

  const openGoogleMapsRoute = (destination: string) => {
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
          const encodedDestination = encodeURIComponent(destination)
          const mapsUrl = `https://www.google.com/maps/search/${encodedDestination}`
          window.open(mapsUrl, '_blank')
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      )
    } else {
      const encodedDestination = encodeURIComponent(destination)
      const mapsUrl = `https://www.google.com/maps/search/${encodedDestination}`
      window.open(mapsUrl, '_blank')
    }
  }

  const openInGoogleCalendar = (event: CalendarEvent) => {
    window.open(event.htmlLink, '_blank', 'noopener,noreferrer')
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
    const events: CalendarEvent[] = []
    
    // Helper function to compare dates by their actual date components (ignoring time)
    const isSameDate = (date1: Date, date2: Date) => {
      return date1.getFullYear() === date2.getFullYear() &&
             date1.getMonth() === date2.getMonth() &&
             date1.getDate() === date2.getDate()
    }
    
    // Add need-to-book events for this date
    if (data) {
      data.needToBookEvents.forEach((event: CalendarEvent) => {
        if (event.start.dateTime) {
          // Create date object from the ISO string - JavaScript will handle timezone conversion
          const eventDate = new Date(event.start.dateTime)
          if (isSameDate(eventDate, date)) {
            events.push(event)
          }
        } else if (event.start.date) {
          // For all-day events, compare the date string directly
          const eventDate = new Date(event.start.date)
          if (isSameDate(eventDate, date)) {
            events.push(event)
          }
        }
      })
      
      // Add nearby jobs for this date
      Object.entries(data.nearbyJobsByDay).forEach(([dateKey, dayData]) => {
        // Handle both ISO date strings (YYYY-MM-DD) and date strings from the API
        let keyDate: Date
        if (dateKey.includes('-')) {
          // ISO date format (YYYY-MM-DD)
          keyDate = new Date(dateKey + 'T00:00:00')
        } else {
          // Legacy date string format
          keyDate = new Date(dateKey)
        }
        
        if (isSameDate(keyDate, date)) {
          const typedDayData = dayData as { needToBookEvent: CalendarEvent; nearbyJobs: Array<{ event: CalendarEvent; distance: number }> }
          typedDayData.nearbyJobs.forEach(({ event }: { event: CalendarEvent; distance: number }) => {
            events.push(event)
          })
        }
      })
    }
    
    return events
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
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate()
  }

  const getTimeRangeForWeek = (weekDates: Date[]) => {
    let earliestHour = 24
    let latestHour = 0
    
    weekDates.forEach(date => {
      const dateEvents = getEventsForDate(date)
      dateEvents.forEach((event: CalendarEvent) => {
        if (event.start.dateTime) {
          // Get the hour from the event's start time
          const eventDate = new Date(event.start.dateTime)
          const eventHour = eventDate.getHours()
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

  const isNearbyJob = (event: CalendarEvent) => {
    if (!showNearbyJobs || !data) {
      return false
    }
    
    // Check if this event is a nearby job for ANY need-to-book event
    const result = Object.entries(data.nearbyJobsByDay).some(([dateKey, dayData]) => {
      const typedDayData = dayData as { needToBookEvent: CalendarEvent; nearbyJobs: Array<{ event: CalendarEvent; distance: number }> }
      
      // Check if this event is a nearby job for this day
      const isNearby = typedDayData.nearbyJobs.some(({ event: nearbyEvent }) => nearbyEvent.id === event.id)
      return isNearby
    })
    
    return result
  }

  const getNearbyJobDistance = (event: CalendarEvent) => {
    if (!showNearbyJobs || !data) {
      return 0
    }
    
    // Find the distance for this nearby job
    for (const [dateKey, dayData] of Object.entries(data.nearbyJobsByDay)) {
      const typedDayData = dayData as { needToBookEvent: CalendarEvent; nearbyJobs: Array<{ event: CalendarEvent; distance: number }> }
      const nearbyJob = typedDayData.nearbyJobs.find(({ event: nearbyEvent }) => nearbyEvent.id === event.id)
      if (nearbyJob) {
        return nearbyJob.distance
      }
    }
    return 0
  }

  const renderCalendarView = () => {
    if (!data) return null
    
    const weekDates = getWeekDates(startDate)
    const { startHour, totalHours } = getTimeRangeForWeek(weekDates)
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Legend and Controls */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex flex-col space-y-3">
            {/* Calendar Color Key */}
            <div className="flex items-center space-x-4 text-xs">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Calendar Colors:</span>
              {Object.entries(calendarColors).map(([calendarId, color]) => (
                <div key={calendarId} className="flex items-center space-x-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: color }}></div>
                  <span className="text-gray-600 dark:text-gray-400">
                    {calendarNames[calendarId] || (calendarId === 'primary' ? 'Primary' : calendarId)}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Nearby Jobs Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="nearby-jobs"
                    checked={showNearbyJobs}
                    onChange={(e) => setShowNearbyJobs(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label htmlFor="nearby-jobs" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Show Nearby Jobs
                  </label>
                </div>
                
                {showNearbyJobs && data.needToBookEvents.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <label htmlFor="need-to-book-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      For:
                    </label>
                    <select
                      id="need-to-book-select"
                      value={selectedNeedToBookEvent}
                      onChange={(e) => setSelectedNeedToBookEvent(e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">All &quot;Need to book&quot; events</option>
                      {data.needToBookEvents.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.summary} - {new Date(event.start.dateTime || event.start.date || '').toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded border-2 border-yellow-400" style={{ backgroundColor: 'rgba(255, 255, 0, 0.3)' }}></div>
                <span className="text-xs text-gray-600 dark:text-gray-400">Nearby Jobs (highlighted)</span>
              </div>
            </div>
            

          </div>
        </div>

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
                  // Get the hour from the event's start time
                  const eventDate = new Date(event.start.dateTime)
                  const eventHour = eventDate.getHours()
                  return eventHour === hour
                })

                return (
                  <div key={hour} className="h-16 border-b border-gray-100 dark:border-gray-600 relative">
                    {hourEvents.map((event: CalendarEvent, eventIndex) => {
                      // Get the start and end times for positioning
                      const startTime = new Date(event.start.dateTime!)
                      const endTime = new Date(event.end.dateTime || event.start.dateTime!)
                      const duration = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60) // hours
                      const topOffset = (startTime.getMinutes() / 60) * 64 // 64px = 1 hour height
                      const height = Math.max(duration * 64, 20) // minimum height of 20px
                      
                      // Determine if this is a &quot;need to book&quot; event
                      const isNeedToBook = data.needToBookEvents.some(ntbEvent => ntbEvent.id === event.id)
                      const backgroundColor = isNeedToBook ? '#f97316' : (event.backgroundColor || '#4285f4')
                      
                      // Determine if this is a nearby job from need-to-book data
                      const isNearbyJobEvent = isNearbyJob(event)
                      const distance = getNearbyJobDistance(event)
                      
                      // Add yellow border for nearby jobs
                      const borderStyle = isNearbyJobEvent ? '2px solid #f59e0b' : 'none'

                      return (
                        <div
                          key={event.id}
                          className="absolute left-1 right-1 rounded px-2 py-1 text-xs text-white overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                          style={{
                            top: `${topOffset}px`,
                            height: `${height}px`,
                            backgroundColor,
                            border: borderStyle,
                            zIndex: eventIndex + 1
                          }}
                          onClick={() => openInGoogleCalendar(event)}
                          title={`${event.summary} - ${formatTime(event.start.dateTime!)}${isNearbyJobEvent ? ` (${distance.toFixed(1)}km away)` : ''}`}
                        >
                          <div className="font-medium truncate">{event.summary}</div>
                          {height > 30 && (
                            <div className="text-xs opacity-90 truncate">
                              {formatTime(event.start.dateTime!)} - {formatTime(event.end.dateTime || event.start.dateTime!)}
                              {isNearbyJobEvent && <span className="ml-1">({distance.toFixed(1)}km)</span>}
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-0">
              Need to Book
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
            Events with &quot;Need to book&quot; in the title and nearby jobs within 20km
          </p>
        </div>

        {loading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading need-to-book events...</p>
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
                  Error loading events
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={fetchNeedToBookEvents}
                    className="bg-red-100 dark:bg-red-800 hover:bg-red-200 dark:hover:bg-red-700 text-red-800 dark:text-red-200 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            {viewMode === 'list' ? (
              <>
                {/* Calendar Color Key */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Calendar Colors</h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      {Object.entries(calendarColors).map(([calendarId, color]) => (
                        <div key={calendarId} className="flex items-center space-x-2">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: color }}></div>
                          <span className="text-gray-600 dark:text-gray-400">
                            {calendarNames[calendarId] || (calendarId === 'primary' ? 'Primary' : calendarId)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {data.needToBookEvents.length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      All &quot;Need to Book&quot; Events ({data.needToBookEvents.length})
                    </h2>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {data.needToBookEvents.map(event => (
                          <div key={event.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0 w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
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
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {Object.keys(data.nearbyJobsByDay).length > 0 && (
                  <div className="mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                      Optimal Booking Days - Jobs Within 20km ({Object.keys(data.nearbyJobsByDay).length} opportunities)
                    </h2>
                    <div className="space-y-6">
                      {Object.entries(data.nearbyJobsByDay)
                        .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                        .map(([dateKey, dayData]) => (
                          <div key={dateKey} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
                              <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                                📍 {new Date(dateKey).toLocaleDateString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })} - Book on this day!
                              </h3>
                              <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                                {dayData.nearbyJobs.length} job{dayData.nearbyJobs.length !== 1 ? 's' : ''} within 20km of your &quot;Need to book&quot; location
                              </p>
                            </div>
                            
                            <div className="px-6 py-4 bg-orange-50 dark:bg-orange-900/20 border-b border-gray-200 dark:border-gray-700">
                              <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-3 h-3 bg-orange-500 rounded-full mt-2"></div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-orange-800 dark:text-orange-200 text-sm">
                                    Need to Book: {dayData.needToBookEvent.summary}
                                  </h4>
                                  <p className="text-xs text-orange-600 dark:text-orange-300 mt-1">
                                    {formatEventDate(dayData.needToBookEvent)}
                                  </p>
                                  {dayData.needToBookEvent.location && (
                                    <p className="text-xs text-orange-600 dark:text-orange-300 mt-1 flex items-center">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      {dayData.needToBookEvent.location}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => openInGoogleCalendar(dayData.needToBookEvent)}
                                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                                  >
                                    View
                                  </button>
                                  {dayData.needToBookEvent.location && (
                                    <button
                                      onClick={() => openGoogleMapsRoute(dayData.needToBookEvent.location!)}
                                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                                    >
                                      Directions
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                              {dayData.nearbyJobs.map(({ event, distance }) => (
                                <div key={event.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                  <div className="flex items-start space-x-3">
                                    <div 
                                      className="flex-shrink-0 w-2 h-2 rounded-full mt-2"
                                      style={{ 
                                        backgroundColor: event.backgroundColor || '#4285f4'
                                      }}
                                      title={`Calendar: ${event.calendarId || 'Primary'}`}
                                    ></div>
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2">
                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                                          {event.summary || 'Untitled Event'}
                                        </h4>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                          {distance.toFixed(1)}km away
                                        </span>
                                      </div>
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
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <button
                                        onClick={() => openInGoogleCalendar(event)}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                                      >
                                        View
                                      </button>
                                      {event.location && (
                                        <button
                                          onClick={() => openGoogleMapsRoute(event.location!)}
                                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors"
                                        >
                                          Directions
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {data.needToBookEvents.length === 0 && (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No &quot;Need to book&quot; events found</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      You don&apos;t have any events with &quot;Need to book&quot; in the title from {new Date(startDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })} onwards.
                    </p>
                  </div>
                )}
              </>
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
