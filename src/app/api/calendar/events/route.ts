import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { google } from 'googleapis'
import { authOptions } from '../../../../lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
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

    // Get calendar events for the next 30 days
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(now.getDate() + 30)

    console.log('Calling Google Calendar API...')
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: thirtyDaysFromNow.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime',
    })

    const events = response.data.items || []
    console.log(`Successfully fetched ${events.length} events`)

    return NextResponse.json({ events })
  } catch (error: any) {
    console.error('Calendar API error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      status: error.status,
      response: error.response?.data
    })
    return NextResponse.json(
      { 
        error: 'Failed to fetch calendar events',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
