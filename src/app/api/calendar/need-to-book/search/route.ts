import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../../lib/auth'
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

interface SearchRequest {
  needToBookEvent: CalendarEvent
  allEvents: CalendarEvent[]
  searchStartDate: string
  searchEndDate: string
}

// Function to calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  const distance = R * c // Distance in kilometers
  return distance
}

// Function to get coordinates from address using Google Geocoding API
async function getCoordinatesFromAddress(address: string, apiKey: string): Promise<{lat: number, lng: number} | null> {
  try {
    const encodedAddress = encodeURIComponent(address)
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`
    console.log(`Geocoding URL: ${url}`)
    
    const response = await fetch(url)
    const data = await response.json()
    
    console.log(`Geocoding response for "${address}":`, data)
    
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location
      console.log(`Geocoded "${address}" to:`, location)
      return { lat: location.lat, lng: location.lng }
    } else {
      console.warn(`Geocoding failed for "${address}". Status: ${data.status}, Error: ${data.error_message || 'No error message'}`)
    }
    return null
  } catch (error) {
    console.error('Error geocoding address:', error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null
    
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchRequest: SearchRequest = await request.json()
    const { needToBookEvent, allEvents, searchStartDate, searchEndDate } = searchRequest

    console.log(`Searching for jobs near "${needToBookEvent.summary}" from ${searchStartDate} to ${searchEndDate}`)
    console.log(`Need to book location: ${needToBookEvent.location}`)
    
    // For distance calculations, we need Google Maps API key
    // Try server-side key first, then fall back to public key
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
    console.log('🔑 Checking Google Maps API key availability...')
    console.log('🔍 GOOGLE_MAPS_API_KEY exists:', !!process.env.GOOGLE_MAPS_API_KEY)
    console.log('🔍 NEXT_PUBLIC_GOOGLE_MAPS_API_KEY exists:', !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
    
    if (!googleMapsApiKey) {
      console.warn('❌ Google Maps API key not found. Using simplified search.')
      console.warn('Available env vars:', Object.keys(process.env).filter(k => k.includes('GOOGLE')))
      // Fallback to simplified search without exact distance calculations
      const nearbyJobs = performSimplifiedSearch(needToBookEvent, allEvents)
      return NextResponse.json({ 
        nearbyJobs, 
        warning: 'Distance calculations unavailable - using simplified search. Configure GOOGLE_MAPS_API_KEY for accurate distances.' 
      })
    }
    
    console.log('✅ Google Maps API key found, attempting geocoding...')

    if (!needToBookEvent.location) {
      console.warn('Need to book event has no location')
      return NextResponse.json({ nearbyJobs: [] })
    }

    // Get coordinates for the "Need to book" event location
    console.log(`🗺️ Geocoding location: ${needToBookEvent.location}`)
    const needToBookCoords = await getCoordinatesFromAddress(needToBookEvent.location, googleMapsApiKey)
    console.log('📍 Geocoded coordinates:', needToBookCoords)
    
    if (!needToBookCoords) {
      console.warn(`❌ Could not geocode location: ${needToBookEvent.location}`)
      console.warn('🔧 Falling back to simplified search...')
      const nearbyJobs = performSimplifiedSearch(needToBookEvent, allEvents)
      return NextResponse.json({ 
        nearbyJobs,
        warning: 'Geocoding failed for target location - using simplified time-based search'
      })
    }

    const nearbyJobs: Array<{event: CalendarEvent, distance: number, date: string}> = []

    // Filter events to search through
    const eventsToSearch = allEvents.filter(event => 
      event.id !== needToBookEvent.id && 
      event.location && 
      event.location.trim() !== '' &&
      !event.summary?.toLowerCase().includes('need to book')
    )

    console.log(`Searching through ${eventsToSearch.length} events with locations`)

    for (const event of eventsToSearch) {
      console.log(`Geocoding event: ${event.summary} at ${event.location}`)
      
      // Get coordinates for this event
      const eventCoords = await getCoordinatesFromAddress(event.location!, googleMapsApiKey)
      if (!eventCoords) {
        console.log(`Could not geocode: ${event.location}`)
        continue
      }

      console.log(`Event coordinates: ${eventCoords.lat}, ${eventCoords.lng}`)

      // Calculate distance
      const distance = calculateDistance(
        needToBookCoords.lat, needToBookCoords.lng,
        eventCoords.lat, eventCoords.lng
      )

      console.log(`Distance calculated: ${distance.toFixed(2)}km between ${needToBookEvent.location} and ${event.location}`)

      // Only include events within 20km
      if (distance <= 20) {
        const eventDate = new Date(event.start.dateTime || event.start.date || '')
        nearbyJobs.push({
          event,
          distance,
          date: eventDate.toDateString()
        })
        console.log(`Added nearby job: ${event.summary} (${distance.toFixed(2)}km)`)
      } else {
        console.log(`Event too far: ${distance.toFixed(2)}km > 20km`)
      }
    }

    // Sort by distance
    nearbyJobs.sort((a, b) => a.distance - b.distance)

    console.log(`Found ${nearbyJobs.length} jobs within 20km`)

    return NextResponse.json({ nearbyJobs })
  } catch (error: unknown) {
    console.error('Search API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to search for nearby jobs',
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}

function performSimplifiedSearch(needToBookEvent: CalendarEvent, allEvents: CalendarEvent[]): Array<{event: CalendarEvent, distance: number, date: string}> {
  console.log('🔧 FALLBACK: Using simplified search - Google Maps geocoding unavailable')
  const nearbyJobs: Array<{event: CalendarEvent, distance: number, date: string}> = []
  
  const targetDate = new Date(needToBookEvent.start.dateTime || needToBookEvent.start.date || '')
  console.log(`🎯 Target event date: ${targetDate.toISOString()}`)
  
  // Filter events and group by day
  const eventsToSearch = allEvents.filter(event => 
    event.id !== needToBookEvent.id && 
    event.location && 
    event.location.trim() !== '' &&
    !event.summary?.toLowerCase().includes('need to book')
  )

  console.log(`📋 Searching through ${eventsToSearch.length} events with locations`)

  eventsToSearch.forEach(event => {
    const eventDate = new Date(event.start.dateTime || event.start.date || '')
    const dayDiff = Math.abs((eventDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24))
    
    console.log(`📅 Event: "${event.summary}" on ${eventDate.toISOString()}`)
    console.log(`⏰ Day difference: ${dayDiff.toFixed(4)} days`)
    
    // Consider events within 7 days as potentially nearby (simplified approach)
    if (dayDiff <= 7) {
      const estimatedDistance = Math.max(0.1, dayDiff * 10) // Improved estimate: 10km per day difference, minimum 0.1km
      console.log(`✅ Adding job with estimated distance: ${estimatedDistance.toFixed(1)}km`)
      
      nearbyJobs.push({
        event,
        distance: estimatedDistance,
        date: eventDate.toDateString()
      })
    } else {
      console.log(`❌ Event too far in time: ${dayDiff.toFixed(2)} days > 7 days`)
    }
  })
  
  console.log(`📊 Found ${nearbyJobs.length} nearby jobs using simplified search`)
  return nearbyJobs.sort((a, b) => a.distance - b.distance)
}
