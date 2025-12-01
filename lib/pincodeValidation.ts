const PINCODE_API_BASE = 'https://api.postalpincode.in/pincode'

interface PostOffice {
  Name: string
  District: string
  Division: string
  Region: string
  Block: string
  State: string
  Country: string
  Pincode: string
}

interface PincodeApiResponse {
  Message: string
  Status: 'Success' | 'Error' | '404'
  PostOffice: PostOffice[] | null
}

export interface PincodeValidationResult {
  valid: boolean
  pincode: string
  city?: string           // Post office name (town/village)
  locality?: string       // District (administrative area)
  state?: string
  block?: string
  cityOptions?: string[]  // All available post office names for selection
  error?: string
}

/**
 * Validates an Indian pincode and returns location details
 * - city: Post office name (actual town/village)
 * - locality: District (administrative area)
 * - state: State
 */
export async function validatePincode(pincode: string): Promise<PincodeValidationResult> {
  if (!pincode || !/^\d{6}$/.test(pincode.trim())) {
    return {
      valid: false,
      pincode: pincode || '',
      error: 'Invalid pincode format. Must be 6 digits.',
    }
  }

  const cleanPincode = pincode.trim()

  try {
    const response = await fetch(`${PINCODE_API_BASE}/${cleanPincode}`)

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data: PincodeApiResponse[] = await response.json()
    const result = data[0]

    if (result?.Status !== 'Success' || !result.PostOffice?.length) {
      return {
        valid: false,
        pincode: cleanPincode,
        error: 'Invalid pincode. No matching location found.',
      }
    }

    const postOffices = result.PostOffice
    const firstPO = postOffices[0]

    // Get unique city names (post office names)
    const cityOptions = [...new Set(postOffices.map((po) => po.Name))]

    const validationResult: PincodeValidationResult = {
      valid: true,
      pincode: cleanPincode,
      city: firstPO.Name,           // Town/village name
      locality: firstPO.District,   // District as locality
      state: firstPO.State,
      block: firstPO.Block,
      cityOptions,                  // All available options for dropdown
    }

    return validationResult
  } catch (error) {
    console.error('Pincode validation error:', error)
    return {
      valid: false,
      pincode: cleanPincode,
      error: 'Failed to validate pincode. Please check your connection.',
    }
  }
}

/** Quick check if pincode exists */
export async function isPincodeValid(pincode: string): Promise<boolean> {
  const result = await validatePincode(pincode)
  return result.valid
}

/** Auto-fill location from pincode */
export async function autofillFromPincode(
  pincode: string
): Promise<{ city: string; locality: string; state: string; cityOptions: string[] } | null> {
  const result = await validatePincode(pincode)
  if (!result.valid) return null
  return {
    city: result.city!,
    locality: result.locality!,
    state: result.state!,
    cityOptions: result.cityOptions || [],
  }
}
