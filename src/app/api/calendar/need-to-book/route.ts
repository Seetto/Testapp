import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { google } from 'googleapis'
import { authOptions } from '../../../../lib/auth'
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
}

// Function to get coordinates from address using Google Geocoding API
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getCoordinatesFromAddress(address: string, apiKey: string): Promise<{lat: number, lng: number} | null> {
  try {
    const encodedAddress = encodeURIComponent(address)
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`
    )
    const data = await response.json()
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location
      return { lat: location.lat, lng: location.lng }
    }
    return null
  } catch (error) {
    console.error('Error geocoding address:', error)
    return null
  }
}

// Function to get driving distance using Google Distance Matrix API
async function getDrivingDistance(
  origin: string, 
  destination: string, 
  apiKey: string
): Promise<number | null> {
  try {
    const encodedOrigin = encodeURIComponent(origin)
    const encodedDestination = encodeURIComponent(destination)
    
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodedOrigin}&destinations=${encodedDestination}&mode=driving&key=${apiKey}`
    )
    
    const data = await response.json()
    
    if (data.status === 'OK' && data.rows.length > 0 && data.rows[0].elements.length > 0) {
      const element = data.rows[0].elements[0]
      if (element.status === 'OK') {
        // Distance is returned in meters, convert to kilometers
        return element.distance.value / 1000
      }
    }
    
    console.warn(`Distance Matrix API returned status: ${data.status} for ${origin} to ${destination}`)
    return null
  } catch (error) {
    console.error('Error getting driving distance:', error)
    return null
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null
    
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get start date from URL parameters
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    })

    // Create Calendar API client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // First, find the "Need to Book" calendar by name
    console.log('Searching for "Need to Book" calendar...')
    const calendarListResponse = await calendar.calendarList.list({
      maxResults: 100,
      showHidden: false,
    })
    
    const allCalendars = calendarListResponse.data.items || []
    const needToBookCalendar = allCalendars.find(cal => 
      cal.summary && cal.summary.toLowerCase().includes('need to book')
    )
    
    if (!needToBookCalendar) {
      console.log('No "Need to Book" calendar found')
      return NextResponse.json({ 
        needToBookEvents: [],
        nearbyJobsByDay: {},
        warning: 'No "Need to Book" calendar found. Please create a calendar with "Need to Book" in the name.'
      })
    }
    
    console.log(`Found "Need to Book" calendar: ${needToBookCalendar.summary} (${needToBookCalendar.id})`)

    // Set date range based on start date parameter or default to today
    const startDate = startDateParam ? new Date(startDateParam) : new Date()
    startDate.setHours(0, 0, 0, 0)
    
    // Get events up to 90 days from start date
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 90)

    console.log('Fetching all calendar events from "Need to Book" calendar...')
    console.log('Calendar ID:', needToBookCalendar.id)
    
    const response = await calendar.events.list({
      calendarId: needToBookCalendar.id!,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      maxResults: 500, // Increased to get more events for analysis
      singleEvents: true,
      orderBy: 'startTime',
    })

    const allEvents = (response.data.items as CalendarEvent[]) || []
    
    // Get all events from the calendar (since we're now looking in a specific "Need to Book" calendar)
    const needToBookEvents = allEvents

    console.log(`Found ${needToBookEvents.length} events from "Need to Book" calendar`)

    // For distance calculations, we need Google Maps API key
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
    if (!googleMapsApiKey) {
      console.warn('Google Maps API key not found. Distance calculations will be disabled.')
      return NextResponse.json({ 
        needToBookEvents,
        nearbyJobsByDay: {},
        warning: 'Distance calculations unavailable - Google Maps API key not configured'
      })
    }

    // Calculate nearby jobs for each "Need to book" event
    const nearbyJobsByDay: NearbyJobsResponse['nearbyJobsByDay'] = {}

    for (const needToBookEvent of needToBookEvents) {
      if (!needToBookEvent.location) continue

      console.log(`Processing need-to-book event: ${needToBookEvent.summary} at ${needToBookEvent.location}`)

      // Get all events on the same day or nearby days
      const eventDate = new Date(needToBookEvent.start.dateTime || needToBookEvent.start.date || '')
      // Use ISO date string (YYYY-MM-DD) for consistent date handling across timezones
      const dayKey = eventDate.toISOString().split('T')[0]

      // Check events within 7 days before and after from all accessible calendars
      const nearbyEvents: Array<{event: CalendarEvent, distance: number}> = []

      // Get all accessible calendars to search for nearby jobs
      const allCalendarsResponse = await calendar.calendarList.list({
        maxResults: 100,
        showHidden: false,
      })
      
      const accessibleCalendars = allCalendarsResponse.data.items || []
      
      for (const accessibleCalendar of accessibleCalendars) {
        // Skip the "Need to Book" calendar itself and any calendar with "need to book" in the name
        if (accessibleCalendar.id === needToBookCalendar.id || 
            (accessibleCalendar.summary && accessibleCalendar.summary.toLowerCase().includes('need to book'))) continue
        
        try {
          // Get events from this calendar
          const calendarEventsResponse = await calendar.events.list({
            calendarId: accessibleCalendar.id!,
            timeMin: startDate.toISOString(),
            timeMax: endDate.toISOString(),
            maxResults: 250,
            singleEvents: true,
            orderBy: 'startTime',
          })
          
          const calendarEvents = calendarEventsResponse.data.items || []
          
                     for (const event of calendarEvents) {
             // Skip events without locations or IDs
             if (!event.location || !event.id || !event.start) continue

             const eventDate = new Date(event.start.dateTime || event.start.date || '')
             const dayDifference = Math.abs((eventDate.getTime() - new Date(needToBookEvent.start.dateTime || needToBookEvent.start.date || '').getTime()) / (1000 * 60 * 60 * 24))
             
             // Only consider events within 7 days
             if (dayDifference > 7) continue

             console.log(`Checking event: ${event.summary} at ${event.location} (${dayDifference} days difference) from calendar ${accessibleCalendar.summary}`)

             // Get driving distance using Google Distance Matrix API
             const distance = await getDrivingDistance(
               needToBookEvent.location,
               event.location,
               googleMapsApiKey
             )

             if (distance !== null && distance <= 20) {
               console.log(`Found nearby job: ${event.summary} - ${distance.toFixed(1)}km away`)
               // Cast the event to CalendarEvent type
               const calendarEvent: CalendarEvent = {
                 id: event.id,
                 summary: event.summary || '',
                 description: event.description || undefined,
                 start: {
                   dateTime: event.start.dateTime || undefined,
                   date: event.start.date || undefined,
                   timeZone: event.start.timeZone || undefined
                 },
                 end: {
                   dateTime: event.end?.dateTime || event.start.dateTime || undefined,
                   date: event.end?.date || event.start.date || undefined,
                   timeZone: event.end?.timeZone || event.start.timeZone || undefined
                 },
                 location: event.location,
                 htmlLink: event.htmlLink || ''
               }
               nearbyEvents.push({ event: calendarEvent, distance })
             }
           }
        } catch (err) {
          console.warn(`Failed to fetch events from calendar ${accessibleCalendar.summary}:`, err)
        }
      }

      // Sort by distance
      nearbyEvents.sort((a, b) => a.distance - b.distance)

      if (nearbyEvents.length > 0) {
        console.log(`Found ${nearbyEvents.length} nearby jobs for ${needToBookEvent.summary}`)
        nearbyJobsByDay[dayKey] = {
          needToBookEvent,
          nearbyJobs: nearbyEvents
        }
      } else {
        console.log(`No nearby jobs found for ${needToBookEvent.summary}`)
      }
    }

    const result: NearbyJobsResponse = {
      needToBookEvents,
      nearbyJobsByDay
    }

    console.log(`Final result: ${Object.keys(nearbyJobsByDay).length} days with nearby jobs`)
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('Need to book API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to fetch need-to-book events',
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}
