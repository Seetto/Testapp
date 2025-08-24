import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { google } from 'googleapis'
import { authOptions } from '../../../../../lib/auth'
import { Session } from 'next-auth'

interface ExtendedSession extends Session {
  accessToken?: string
}

interface CalendarEventUpdate {
  summary?: string
  description?: string
  start?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end?: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  location?: string
}

// GET single event
export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const session = await getServerSession(authOptions) as ExtendedSession | null
    
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    })

    // Create Calendar API client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    // Get specific event
    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    })

    return NextResponse.json({ event: response.data })
  } catch (error: unknown) {
    console.error('Calendar API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to fetch calendar event',
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}

// PATCH update event
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params
    const session = await getServerSession(authOptions) as ExtendedSession | null
    
    if (!session || !session.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the update data from request body
    const updateData: CalendarEventUpdate = await request.json()

    // Ensure timezone is set for datetime events if not provided
    if (updateData.start?.dateTime && !updateData.start.timeZone) {
      updateData.start.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    }
    if (updateData.end?.dateTime && !updateData.end.timeZone) {
      updateData.end.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    })

    // Create Calendar API client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    console.log('Updating event with data:', JSON.stringify(updateData, null, 2))

    // Update the event
    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: updateData,
    })

    console.log('Google Calendar API response:', JSON.stringify(response.data, null, 2))

    return NextResponse.json({ 
      success: true, 
      event: response.data,
      message: 'Event updated successfully'
    })
  } catch (error: unknown) {
    console.error('Calendar update error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to update calendar event',
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}
