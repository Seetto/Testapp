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
  calendarId?: string
  backgroundColor?: string
  foregroundColor?: string
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null
    
    console.log('Session:', session ? 'exists' : 'null')
    console.log('Access token:', session?.accessToken ? 'exists' : 'missing')
    
    if (!session || !session.accessToken) {
      console.log('Unauthorized: No session or access token')
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
    // Set start to beginning of the day
    startDate.setHours(0, 0, 0, 0)
    
    // Get events up to 90 days from start date to ensure we have enough events
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 90)

    console.log('Calling Google Calendar API...')
    console.log('Calendar ID:', calendarIdParam)
    console.log('Start date:', startDate.toISOString())
    console.log('End date:', endDate.toISOString())
    
    const response = await calendar.events.list({
      calendarId: calendarIdParam,
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = (response.data.items as CalendarEvent[]) || []
    console.log(`Successfully fetched ${events.length} events`)

    // Get calendar information to add colors
    let calendarInfo: { backgroundColor?: string; foregroundColor?: string } = {}
    if (calendarIdParam !== 'primary') {
      try {
        const calendarResponse = await calendar.calendarList.get({ calendarId: calendarIdParam })
        calendarInfo = {
          backgroundColor: calendarResponse.data.backgroundColor || undefined,
          foregroundColor: calendarResponse.data.foregroundColor || undefined
        }
      } catch (err) {
        console.warn('Could not fetch calendar info for colors:', err)
      }
    }

    // Add calendar information to events
    const eventsWithCalendarInfo = events.map(event => ({
      ...event,
      calendarId: calendarIdParam,
      backgroundColor: calendarInfo.backgroundColor,
      foregroundColor: calendarInfo.foregroundColor
    }))

    return NextResponse.json({ events: eventsWithCalendarInfo })
  } catch (error: unknown) {
    console.error('Calendar API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to fetch calendar events',
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}
