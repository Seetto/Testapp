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

    // Get start date and calendar ID from URL parameters
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get('startDate')
    const calendarIdParam = searchParams.get('calendarId') || 'primary'
    
    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    })

    // Create Calendar API client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Set date range based on start date parameter or default to today
    const startDate = startDateParam ? new Date(startDateParam) : new Date()
    startDate.setHours(0, 0, 0, 0)
    
    // Get events up to 90 days from start date
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 90)

    console.log('Fetching all calendar events for need-to-book analysis...')
    console.log('Calendar ID:', calendarIdParam)
    
    const response = await calendar.events.list({
      calendarId: calendarIdParam,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      maxResults: 500, // Increased to get more events for analysis
      singleEvents: true,
      orderBy: 'startTime',
    })

    const allEvents = (response.data.items as CalendarEvent[]) || []
    
    // Filter events with "Need to book" in the title (case insensitive)
    const needToBookEvents = allEvents.filter(event => 
      event.summary && event.summary.toLowerCase().includes('need to book')
    )

    console.log(`Found ${needToBookEvents.length} "Need to book" events out of ${allEvents.length} total events`)

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

      // Check events within 7 days before and after
      const nearbyEvents: Array<{event: CalendarEvent, distance: number}> = []

      for (const event of allEvents) {
        // Skip the "Need to book" event itself and events without locations
        if (event.id === needToBookEvent.id || !event.location || 
            event.summary?.toLowerCase().includes('need to book')) continue

        const eventDate = new Date(event.start.dateTime || event.start.date || '')
        const dayDifference = Math.abs((eventDate.getTime() - new Date(needToBookEvent.start.dateTime || needToBookEvent.start.date || '').getTime()) / (1000 * 60 * 60 * 24))
        
        // Only consider events within 7 days
        if (dayDifference > 7) continue

        console.log(`Checking event: ${event.summary} at ${event.location} (${dayDifference} days difference)`)

        // Get driving distance using Google Distance Matrix API
        const distance = await getDrivingDistance(
          needToBookEvent.location,
          event.location,
          googleMapsApiKey
        )

        if (distance !== null && distance <= 20) {
          console.log(`Found nearby job: ${event.summary} - ${distance.toFixed(1)}km away`)
          nearbyEvents.push({ event, distance })
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
