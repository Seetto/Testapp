'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import { Session } from 'next-auth'

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
  const [searchResults, setSearchResults] = useState<{
    needToBookEvent: CalendarEvent
    nearbyJobs: Array<{event: CalendarEvent, distance: number, date: string}>
    warning?: string
  } | null>(null)
  const [startDate, setStartDate] = useState<string>(() => {
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
      fetchNeedToBookEvents()
    }
  }, [session, startDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchNeedToBookEvents = async () => {
    try {
      setLoading(true)
      const url = `/api/calendar/need-to-book?startDate=${startDate}`
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

  const searchNearbyDays = async (needToBookEvent: CalendarEvent) => {
    if (!needToBookEvent.location) {
      alert('This event does not have a location to search around.')
      return
    }

    try {
      setLoading(true)
      
      // Get the date of the "Need to book" event
      const eventDate = new Date(needToBookEvent.start.dateTime || needToBookEvent.start.date || '')
      
      // Search the entire week around this event (3 days before and after)
      const searchStartDate = new Date(eventDate)
      searchStartDate.setDate(eventDate.getDate() - 3)
      
      const searchEndDate = new Date(eventDate)
      searchEndDate.setDate(eventDate.getDate() + 3)
      
      // Fetch ALL calendar events for the week to search through
      const allEventsUrl = `/api/calendar/events?startDate=${searchStartDate.toISOString().split('T')[0]}`
      const allEventsResponse = await fetch(allEventsUrl)
      
      if (!allEventsResponse.ok) {
        throw new Error('Failed to fetch calendar events for search')
      }
      
      const allEventsData = await allEventsResponse.json()
      const allEvents = allEventsData.events || []
      
      // Now create a comprehensive search request to find nearby jobs
      const searchUrl = `/api/calendar/need-to-book/search`
      const searchResponse = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          needToBookEvent,
          allEvents,
          searchStartDate: searchStartDate.toISOString(),
          searchEndDate: searchEndDate.toISOString()
        })
      })
      
      if (!searchResponse.ok) {
        console.error(`Search API failed with status: ${searchResponse.status}`)
        const errorText = await searchResponse.text()
        console.error('Search API error response:', errorText)
        
        alert(`Search API failed (${searchResponse.status}). Using simplified search without accurate distances. Check console for details.`)
        
        // If the new endpoint doesn't exist, fall back to client-side calculation
        const nearbyJobs = await findNearbyJobsClientSide(needToBookEvent, allEvents)
        displaySearchResults(needToBookEvent, nearbyJobs, 'Using simplified search - Google Maps API unavailable')
        return
      }
      
      const searchResults = await searchResponse.json()
      console.log('Search API returned:', searchResults)
      
      if (searchResults.warning) {
        console.warn('Search API warning:', searchResults.warning)
      }
      
      displaySearchResults(needToBookEvent, searchResults.nearbyJobs || [], searchResults.warning)

    } catch (error) {
      console.error('Error searching nearby days:', error)
      // Fallback: try to search with current data
      try {
        const allEventsUrl = `/api/calendar/events?startDate=${startDate}`
        const allEventsResponse = await fetch(allEventsUrl)
        const allEventsData = await allEventsResponse.json()
        const nearbyJobs = await findNearbyJobsClientSide(needToBookEvent, allEventsData.events || [])
        displaySearchResults(needToBookEvent, nearbyJobs, 'Using fallback search - API connection failed')
      } catch (fallbackError) {
        console.error('Fallback search failed:', fallbackError)
        alert('Failed to search for nearby days. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const findNearbyJobsClientSide = async (needToBookEvent: CalendarEvent, allEvents: CalendarEvent[]) => {
    // This is a client-side fallback for finding nearby jobs
    console.log('WARNING: Using client-side fallback - distances will be marked as unknown')
    console.log('This means the Google Maps API geocoding is not working properly')
    
    const nearbyJobs: Array<{event: CalendarEvent, distance: number, date: string}> = []
    
    // Filter out the "Need to book" event itself and events without locations
    const eventsWithLocations = allEvents.filter(event => 
      event.id !== needToBookEvent.id && 
      event.location && 
      event.location.trim() !== '' &&
      !event.summary?.toLowerCase().includes('need to book')
    )
    
    console.log(`Client-side searching through ${eventsWithLocations.length} events`)
    
    // Since we can't calculate real distances without geocoding,
    // only return events that are on the same day or very close days
    // and mark them all as "distance unknown"
    
    const targetDate = new Date(needToBookEvent.start.dateTime || needToBookEvent.start.date || '')
    
    eventsWithLocations.forEach(event => {
      const eventDate = new Date(event.start.dateTime || event.start.date || '')
      const dayDiff = Math.abs((eventDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))
      
      // Only include events within 2 days to be conservative since we can't calculate real distance
      if (dayDiff <= 2) {
        nearbyJobs.push({
          event,
          distance: 999, // Use 999 to indicate this is an estimate/unknown distance
          date: eventDate.toDateString()
        })
      }
    })
    
    console.log(`Client-side found ${nearbyJobs.length} events within 2 days (distances unknown)`)
    console.log('To get accurate distances, ensure Google Maps API key is configured properly')
    
    return nearbyJobs
  }

  const displaySearchResults = (needToBookEvent: CalendarEvent, nearbyJobs: Array<{event: CalendarEvent, distance: number, date: string}>, warning?: string) => {
    if (nearbyJobs.length === 0) {
      const warningText = warning ? `\n\nNote: ${warning}` : ''
      alert(`No jobs found within 20km of "${needToBookEvent.summary}" during the week around this event.\n\nLocation: ${needToBookEvent.location}\n\nTry searching a different week or check if there are other jobs scheduled nearby.${warningText}`)
      return
    }

    // Set the search results to display in the modal
    setSearchResults({ needToBookEvent, nearbyJobs, warning })

    // Try to scroll to relevant section if it exists
    const optimalSection = document.getElementById('optimal-booking-days')
    if (optimalSection) {
      optimalSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const closeSearchResults = () => {
    setSearchResults(null)
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

        {data?.warning && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Warning
                </h3>
                <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                  <p>{data.warning}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Need to book events without nearby jobs */}
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>View in Calendar</span>
                                </button>
                                {event.location && (
                                  <button
                                    onClick={() => searchNearbyDays(event)}
                                    className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-xs font-medium transition-colors flex items-center space-x-1"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    <span>Search</span>
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

            {/* Events with nearby jobs */}
            {Object.keys(data.nearbyJobsByDay).length > 0 && (
              <div className="mb-8" id="optimal-booking-days">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Optimal Booking Days - Jobs Within 20km ({Object.keys(data.nearbyJobsByDay).length} opportunities)
                </h2>
                <div className="space-y-6">
                  {Object.entries(data.nearbyJobsByDay)
                    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                    .map(([dateKey, dayData]) => (
                      <div key={dateKey} data-date-key={dateKey} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
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
                        
                        {/* Need to book event */}
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

                        {/* Nearby jobs */}
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                          {dayData.nearbyJobs.map(({ event, distance }) => (
                            <div key={event.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                              <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
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

            {/* No events found */}
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
        )}

        {/* Search Results Modal */}
        {searchResults && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                      🔍 Search Results for &quot;{searchResults.needToBookEvent.summary}&quot;
                    </h3>
                    <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                      Found {searchResults.nearbyJobs.length} jobs within 20km during the week
                    </p>
                  </div>
                  <button
                    onClick={closeSearchResults}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Warning Section */}
              {searchResults.warning && (
                <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start space-x-2">
                    <div className="text-yellow-600 dark:text-yellow-400 mt-0.5">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Distance Estimation Notice
                      </p>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                        {searchResults.warning}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                {/* Need to Book Event Details */}
                <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <h4 className="font-medium text-orange-800 dark:text-orange-200 mb-2">
                    📍 Event to Schedule:
                  </h4>
                  <div className="text-sm text-orange-700 dark:text-orange-300">
                    <p className="font-medium">{searchResults.needToBookEvent.summary}</p>
                    {searchResults.needToBookEvent.location && (
                      <p className="mt-1">📍 {searchResults.needToBookEvent.location}</p>
                    )}
                    <p className="mt-1">📅 {formatEventDate(searchResults.needToBookEvent)}</p>
                  </div>
                </div>

                {/* Nearby Jobs by Day */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-lg mb-4">
                    📋 Nearby Jobs by Day:
                  </h4>
                  
                  {(() => {
                    // Group jobs by day
                    const jobsByDay: {[date: string]: Array<{event: CalendarEvent, distance: number}>} = {}
                    searchResults.nearbyJobs.forEach(job => {
                      if (!jobsByDay[job.date]) {
                        jobsByDay[job.date] = []
                      }
                      jobsByDay[job.date].push(job)
                    })

                    // Sort days by date
                    const sortedDays = Object.keys(jobsByDay).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
                    
                    return sortedDays.map(dateKey => {
                      const date = new Date(dateKey)
                      const dayJobs = jobsByDay[dateKey]
                      
                      return (
                        <div key={dateKey} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
                            📅 {date.toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                              {dayJobs.length} job{dayJobs.length !== 1 ? 's' : ''}
                            </span>
                          </h5>
                          
                          <div className="space-y-3">
                            {dayJobs.map((job, index) => (
                              <div key={index} className="bg-white dark:bg-gray-800 rounded-md p-3 border border-gray-200 dark:border-gray-600">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h6 className="font-medium text-gray-900 dark:text-white text-sm">
                                      {job.event.summary || 'Untitled Event'}
                                    </h6>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                      {formatEventDate(job.event)}
                                    </p>
                                    {job.event.location && (
                                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 flex items-center">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        {job.event.location}
                                      </p>
                                    )}
                                    {job.event.description && (
                                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                                        {job.event.description}
                                      </p>
                                    )}
                                  </div>
                                  <div className="ml-4 flex flex-col items-end space-y-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      job.distance === 999 
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                                        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                    }`}>
                                      {job.distance === 999 ? 'Distance unknown' : `${job.distance.toFixed(1)}km away`}
                                    </span>
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={() => openInGoogleCalendar(job.event)}
                                        className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                                        title="View in Calendar"
                                      >
                                        📅
                                      </button>
                                      {job.event.location && (
                                        <button
                                          onClick={() => openGoogleMapsRoute(job.event.location!)}
                                          className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
                                          title="Get Directions"
                                        >
                                          🗺️
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>

                {/* Recommendation */}
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                    💡 Scheduling Recommendation:
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Consider booking &quot;{searchResults.needToBookEvent.summary}&quot; on one of the days above to minimize travel time and maximize efficiency!
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                <div className="flex justify-end">
                  <button
                    onClick={closeSearchResults}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
