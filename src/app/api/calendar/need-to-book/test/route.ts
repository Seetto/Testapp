import { NextResponse } from 'next/server'

// Simple test endpoint to verify Google Distance Matrix API
export async function GET() {
  try {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    
    if (!googleMapsApiKey) {
      return NextResponse.json({ 
        error: 'Google Maps API key not found',
        availableKeys: {
          GOOGLE_MAPS_API_KEY: !!process.env.GOOGLE_MAPS_API_KEY,
          NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      })
    }

    // Test with two sample addresses
    const origin = '123 Main St, New York, NY'
    const destination = '456 Broadway, New York, NY'
    
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&key=${googleMapsApiKey}`
    )
    
    const data = await response.json()
    
    return NextResponse.json({
      apiKeyConfigured: true,
      testAddresses: { origin, destination },
      distanceMatrixResponse: data,
      status: data.status,
      hasResults: data.rows && data.rows.length > 0 && data.rows[0].elements && data.rows[0].elements.length > 0,
      distance: data.rows?.[0]?.elements?.[0]?.distance?.text || 'N/A',
      duration: data.rows?.[0]?.elements?.[0]?.duration?.text || 'N/A'
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
