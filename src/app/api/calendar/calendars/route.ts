import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../../../lib/auth'
import { Session } from 'next-auth'
import { google } from 'googleapis'

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

export async function GET() {
  try {
    const session = await getServerSession(authOptions) as ExtendedSession | null
    
    console.log('Session:', session ? 'exists' : 'null')
    console.log('Access token:', session?.accessToken ? 'exists' : 'missing')
    
    if (!session || !session.accessToken) {
      console.log('Unauthorized: No session or access token')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({
      access_token: session.accessToken,
    })

    // Create Calendar API client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    console.log('Calling Google Calendar API to fetch calendar list...')
    
    const response = await calendar.calendarList.list({
      maxResults: 100,
      showHidden: false,
    })

    const calendars = (response.data.items as Calendar[]) || []
    console.log(`Successfully fetched ${calendars.length} calendars`)

    // Filter to only show calendars the user can read events from
    const readableCalendars = calendars.filter(cal => 
      cal.accessRole === 'reader' || 
      cal.accessRole === 'writer' || 
      cal.accessRole === 'owner'
    )

    // Filter out holiday calendars and similar system calendars
    const filteredCalendars = readableCalendars.filter(cal => {
      const summary = cal.summary.toLowerCase()
      const description = (cal.description || '').toLowerCase()
      
      // Exclude calendars that are likely holiday or system calendars
      const holidayKeywords = [
        'holiday', 'holidays', 'australia', 'australian', 'public holiday',
        'national holiday', 'federal holiday', 'state holiday', 'bank holiday',
        'observance', 'observances', 'en.usa', 'en.australia', 'en.gb',
        'calendar', 'calendars', 'system', 'default'
      ]
      
      return !holidayKeywords.some(keyword => 
        summary.includes(keyword) || description.includes(keyword)
      )
    })

    console.log(`${filteredCalendars.length} calendars after filtering out holiday/system calendars`)

    return NextResponse.json({ 
      calendars: filteredCalendars.map(cal => ({
        id: cal.id,
        summary: cal.summary,
        description: cal.description,
        primary: cal.primary,
        accessRole: cal.accessRole,
        backgroundColor: cal.backgroundColor,
        foregroundColor: cal.foregroundColor
      }))
    })
  } catch (error: unknown) {
    console.error('Calendar List API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { 
        error: 'Failed to fetch calendars',
        details: errorMessage 
      },
      { status: 500 }
    )
  }
}
