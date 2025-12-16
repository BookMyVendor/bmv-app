#!/usr/bin/env python3
"""
Script to generate Word document for Budget Breakdown Solution Architecture
"""

try:
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
except ImportError:
    print("Installing python-docx...")
    import subprocess
    subprocess.check_call(["pip", "install", "python-docx"])
    from docx import Document
    from docx.shared import Inches, Pt, RGBColor
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn

def add_heading(doc, text, level=1):
    """Add a heading with consistent styling"""
    heading = doc.add_heading(text, level=level)
    heading.style.font.size = Pt(14 if level == 1 else 12 if level == 2 else 11)
    return heading

def add_code_block(doc, code, language=""):
    """Add a code block with monospace font"""
    para = doc.add_paragraph()
    para.style.font.name = 'Courier New'
    para.style.font.size = Pt(9)
    run = para.add_run(code)
    run.font.name = 'Courier New'
    return para

def add_bullet_list(doc, items):
    """Add a bullet list"""
    for item in items:
        para = doc.add_paragraph(item, style='List Bullet')
        para.style.font.size = Pt(10)

def add_numbered_list(doc, items):
    """Add a numbered list"""
    for item in items:
        para = doc.add_paragraph(item, style='List Number')
        para.style.font.size = Pt(10)

def main():
    # Create document
    doc = Document()
    
    # Set default font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)
    
    # Title
    title = doc.add_heading('Budget Breakdown Solution Architecture', 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    
    # Subtitle
    subtitle = doc.add_paragraph('Detailed Solution, Workflow, and Data Flow')
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.style.font.size = Pt(12)
    subtitle.style.font.italic = True
    
    doc.add_paragraph()  # Spacing
    
    # 1. Data Sources & Availability
    add_heading(doc, '1. Data Sources & Availability', 1)
    
    add_heading(doc, 'Phase 1: Initial (No Pricing History)', 2)
    para = doc.add_paragraph()
    para.add_run('Primary: ').bold = True
    para.add_run('vendor_business_pricing_packages (active packages)')
    para = doc.add_paragraph()
    para.add_run('Secondary: ').bold = True
    para.add_run('vendor_businesses (location, categories, experience)')
    para = doc.add_paragraph()
    para.add_run('Tertiary: ').bold = True
    para.add_run('vendor_business_offers (active discounts)')
    para = doc.add_paragraph()
    para.add_run('Not available: ').bold = True
    para.add_run('Pricing history (invoicing not built yet)')
    
    add_heading(doc, 'Phase 2: Future (With Pricing History)', 2)
    para = doc.add_paragraph()
    para.add_run('Primary: ').bold = True
    para.add_run('vendor_business_pricing_packages + vendor_pricing_history')
    para = doc.add_paragraph()
    para.add_run('Enhanced: ').bold = True
    para.add_run('Historical patterns, actual booking prices')
    para = doc.add_paragraph()
    para.add_run('Improved: ').bold = True
    para.add_run('Better accuracy, trend analysis')
    
    doc.add_page_break()
    
    # 2. Solution Overview
    add_heading(doc, '2. Solution Overview', 1)
    
    solution_diagram = """┌─────────────────────────────────────────────────────────────┐
│                    Budget Breakdown System                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Input: Total Budget + Event Details                        │
│    ↓                                                         │
│  Step 1: Identify Required Categories                        │
│    ↓                                                         │
│  Step 2: Aggregate Vendor Package Pricing                   │
│    ↓                                                         │
│  Step 3: Calculate Price Ranges per Category                │
│    ↓                                                         │
│  Step 4: AI-Powered Budget Allocation                        │
│    ↓                                                         │
│  Step 5: Match Vendors & Packages                            │
│    ↓                                                         │
│  Output: Budget Breakdown + Vendor Suggestions               │
│                                                              │
└─────────────────────────────────────────────────────────────┘"""
    
    add_code_block(doc, solution_diagram)
    
    doc.add_page_break()
    
    # 3. Data Flow Diagram
    add_heading(doc, '3. Data Flow Diagram', 1)
    
    dataflow = """┌──────────────┐
│   Customer   │
│   Input      │
└──────┬───────┘
       │
       │ (Total Budget, Event Type, Guest Count, Location)
       ↓
┌──────────────────────────────────────────────────────────┐
│              Budget Breakdown Service                     │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────┐        │
│  │  Step 1: Category Identification              │        │
│  │  - Query event_templates                     │        │
│  │  - Get required categories via                │        │
│  │    template_category_mapping                  │        │
│  │  - Filter by event type                       │        │
│  └──────────────────┬───────────────────────────┘        │
│                     │                                      │
│  ┌──────────────────▼───────────────────────────┐        │
│  │  Step 2: Package Aggregation                  │        │
│  │  For each category:                           │        │
│  │  - Query vendor_business_pricing_packages     │        │
│  │  - Join with vendor_businesses (location)     │        │
│  │  - Join with vendor_business_category_mappings│        │
│  │  - Filter by:                                 │        │
│  │    • Category match                           │        │
│  │    • Location match (city/state)              │        │
│  │    • Capacity match (guest_count)             │        │
│  │    • Active packages only                     │        │
│  │  - Apply active offers (discounts)            │        │
│  └──────────────────┬───────────────────────────┘        │
│                     │                                      │
│  ┌──────────────────▼───────────────────────────┐        │
│  │  Step 3: Price Calculation                    │        │
│  │  For each category's packages:                 │        │
│  │  - Fixed: Use base_price directly             │        │
│  │  - Per Person: base_price × guest_count        │        │
│  │  - Hourly: base_price × duration (if provided)│        │
│  │  - Custom: Use min_price/max_price range      │        │
│  │  - Apply location multipliers (if configured) │        │
│  │  - Calculate: min, max, avg, median           │        │
│  └──────────────────┬───────────────────────────┘        │
│                     │                                      │
│  ┌──────────────────▼───────────────────────────┐        │
│  │  Step 4: AI Allocation                        │        │
│  │  Input to AI:                                 │        │
│  │  - Total budget                                │        │
│  │  - Category price ranges                       │        │
│  │  - Event type                                  │        │
│  │  - Guest count                                 │        │
│  │  - Industry standard percentages (fallback)    │        │
│  │                                                │        │
│  │  AI Output:                                    │        │
│  │  - Allocated amount per category               │        │
│  │  - Percentage allocation                       │        │
│  │  - Recommendations                            │        │
│  └──────────────────┬───────────────────────────┘        │
│                     │                                      │
│  ┌──────────────────▼───────────────────────────┐        │
│  │  Step 5: Vendor Matching                     │        │
│  │  For each allocated category:                 │        │
│  │  - Find vendors with packages in budget range  │        │
│  │  - Score by:                                   │        │
│  │    • Price fit (within allocated budget)      │        │
│  │    • Rating                                    │        │
│  │    • Experience                                │        │
│  │    • Verified status                           │        │
│  │  - Return top 3-5 suggestions                  │        │
│  └──────────────────┬───────────────────────────┘        │
│                     │                                      │
│  ┌──────────────────▼───────────────────────────┐        │
│  │  Step 6: Validation & Buffer                 │        │
│  │  - Ensure total ≤ budget                      │        │
│  │  - Add 10-15% buffer for contingencies        │        │
│  │  - Adjust if needed                            │        │
│  └──────────────────┬───────────────────────────┘        │
│                     │                                      │
└─────────────────────┼─────────────────────────────────────┘
                      │
                      ↓
              ┌───────────────┐
              │   Response    │
              │   (JSON)      │
              └───────────────┘"""
    
    add_code_block(doc, dataflow)
    
    doc.add_page_break()
    
    # 4. Detailed Workflow
    add_heading(doc, '4. Detailed Workflow', 1)
    
    add_heading(doc, 'Workflow Step 1: Category Identification', 2)
    para = doc.add_paragraph()
    para.add_run('Input:').bold = True
    add_bullet_list(doc, [
        'Event Type (e.g., "Wedding", "Birthday")',
        'Event Template ID (if available)'
    ])
    
    para = doc.add_paragraph()
    para.add_run('Process:').bold = True
    add_numbered_list(doc, [
        'Query event_templates to get event template',
        'Query template_category_mapping to get required categories',
        'Filter categories by is_required = true for essential services',
        'Get category details from categories table'
    ])
    
    para = doc.add_paragraph()
    para.add_run('Output:').bold = True
    para = doc.add_paragraph('List of required categories with priority')
    para.style.font.italic = True
    para = doc.add_paragraph('Example: [Photography (required), Catering (required), Makeup (optional), Decor (optional)]')
    
    para = doc.add_paragraph()
    para.add_run('Data Sources:').bold = True
    add_code_block(doc, """event_templates
  → template_category_mapping (category_id, is_required, priority)
    → categories (category details)""")
    
    add_heading(doc, 'Workflow Step 2: Package Aggregation', 2)
    para = doc.add_paragraph()
    para.add_run('Input:').bold = True
    add_bullet_list(doc, [
        'Category IDs (from Step 1)',
        'Location (city, state)',
        'Guest Count',
        'Event Type'
    ])
    
    para = doc.add_paragraph()
    para.add_run('Process:').bold = True
    para = doc.add_paragraph('1. For each category, query packages:')
    
    sql_query = """SELECT 
  vpp.*,
  vb.city, vb.state, vb.calculated_rating, vb.years_experience,
  vbcm.category_id
FROM vendor_business_pricing_packages vpp
JOIN vendor_businesses vb ON vpp.business_id = vb.id
JOIN vendor_business_category_mappings vbcm ON vb.id = vbcm.business_id
WHERE vbcm.category_id IN (category_ids)
  AND vb.city = input_city
  AND vb.status = 'approved'
  AND vpp.is_active = true
  AND (vpp.min_capacity IS NULL OR vpp.min_capacity <= guest_count)
  AND (vpp.max_capacity IS NULL OR vpp.max_capacity >= guest_count)"""
    
    add_code_block(doc, sql_query)
    
    para = doc.add_paragraph('2. Apply active offers:')
    add_bullet_list(doc, [
        'Join with vendor_business_offers',
        'Calculate discounted prices',
        'Use min(original_price, discounted_price)'
    ])
    
    para = doc.add_paragraph('3. Group by category')
    
    para = doc.add_paragraph()
    para.add_run('Output:').bold = True
    add_bullet_list(doc, [
        'Aggregated package data per category',
        'Price statistics (min, max, avg, median, count)'
    ])
    
    para = doc.add_paragraph()
    para.add_run('Data Sources:').bold = True
    add_code_block(doc, """vendor_business_pricing_packages
  → vendor_businesses (location, status)
  → vendor_business_category_mappings (category filter)
  → vendor_business_offers (discounts)""")
    
    add_heading(doc, 'Workflow Step 3: Price Calculation', 2)
    para = doc.add_paragraph()
    para.add_run('Input:').bold = True
    add_bullet_list(doc, [
        'Package data (from Step 2)',
        'Guest Count',
        'Event Duration (if applicable)',
        'Location (for multipliers)'
    ])
    
    para = doc.add_paragraph()
    para.add_run('Process:').bold = True
    para = doc.add_paragraph('For each package, calculate actual price based on package_type:')
    
    para = doc.add_paragraph()
    para.add_run('A. Fixed Pricing (package_type = \'fixed\')').bold = True
    add_code_block(doc, """Price = base_price
If min_price and max_price exist:
  Price Range = [min_price, max_price]
Else:
  Price Range = [base_price * 0.9, base_price * 1.1] // ±10% buffer""")
    
    para = doc.add_paragraph()
    para.add_run('B. Per Person Pricing (package_type = \'per_person\')').bold = True
    add_code_block(doc, """Price = base_price × guest_count
If min_capacity exists and guest_count < min_capacity:
  Price = base_price × min_capacity (minimum charge)
If max_capacity exists and guest_count > max_capacity:
  Price = base_price × max_capacity + (additional_rate × excess)""")
    
    para = doc.add_paragraph()
    para.add_run('C. Hourly Pricing (package_type = \'hourly\')').bold = True
    add_code_block(doc, """Default duration = 8 hours (if not provided)
Price = base_price × duration
If min_price exists:
  Price = max(Price, min_price) // Minimum charge""")
    
    para = doc.add_paragraph()
    para.add_run('D. Custom Pricing (package_type = \'custom\')').bold = True
    add_code_block(doc, """If min_price and max_price exist:
  Price Range = [min_price, max_price]
Else:
  Use base_price as estimate""")
    
    para = doc.add_paragraph()
    para.add_run('Location Adjustment (Optional - if configured):').bold = True
    add_code_block(doc, """If location_tier_multiplier exists:
  Adjusted Price = Price × location_multiplier""")
    
    para = doc.add_paragraph()
    para.add_run('Output:').bold = True
    add_bullet_list(doc, [
        'Calculated price range per package',
        'Aggregated statistics per category:',
        '  • Min price across all packages',
        '  • Max price across all packages',
        '  • Average price',
        '  • Median price',
        '  • Package count'
    ])
    
    doc.add_page_break()
    
    # Continue with Step 4: AI-Powered Allocation
    add_heading(doc, 'Workflow Step 4: AI-Powered Allocation', 2)
    para = doc.add_paragraph()
    para.add_run('Input:').bold = True
    add_bullet_list(doc, [
        'Total Budget',
        'Category price ranges (from Step 3)',
        'Event Type',
        'Guest Count',
        'Location'
    ])
    
    para = doc.add_paragraph()
    para.add_run('AI Prompt Structure:').bold = True
    ai_prompt = """You are an expert event budget planner. Given the following information:

Total Budget: ₹{totalBudget}
Event Type: {eventType}
Guest Count: {guestCount}
Location: {city}, {state}

Available Categories with Price Ranges:
{For each category:}
  - {categoryName}:
    * Minimum: ₹{minPrice}
    * Maximum: ₹{maxPrice}
    * Average: ₹{avgPrice}
    * Available Packages: {packageCount}
    * Pricing Model: {pricingModel} (fixed/per_person/hourly)

Industry Standard Allocations (for reference):
- Photography: 15-25% of total budget
- Catering: 30-45% of total budget
- Makeup: 5-12% of total budget
- Venue/Decor: 25-40% of total budget
- Entertainment: 8-15% of total budget

Task:
1. Allocate the total budget across these categories
2. Ensure allocations are within the price ranges available
3. Prioritize required categories
4. Leave 10-15% buffer for contingencies
5. Provide reasoning for each allocation

Return JSON with:
{
  "allocations": [
    {
      "categoryId": "...",
      "categoryName": "...",
      "allocatedAmount": 50000,
      "percentage": 20,
      "reasoning": "..."
    }
  ],
  "totalAllocated": 450000,
  "buffer": 50000,
  "bufferPercentage": 10,
  "recommendations": ["..."],
  "confidence": 0.85
}"""
    
    add_code_block(doc, ai_prompt)
    
    para = doc.add_paragraph()
    para.add_run('AI Processing:').bold = True
    add_numbered_list(doc, [
        'Analyze price ranges vs budget',
        'Apply industry standards as baseline',
        'Adjust based on available packages',
        'Ensure feasibility (allocations within price ranges)',
        'Add buffer for contingencies'
    ])
    
    para = doc.add_paragraph()
    para.add_run('Output:').bold = True
    add_bullet_list(doc, [
        'Allocated amount per category',
        'Percentage breakdown',
        'Recommendations',
        'Confidence score'
    ])
    
    para = doc.add_paragraph()
    para.add_run('Fallback (if AI unavailable):').bold = True
    add_bullet_list(doc, [
        'Use industry standard percentages',
        'Adjust based on available price ranges',
        'Manual allocation rules'
    ])
    
    add_heading(doc, 'Workflow Step 5: Vendor Matching', 2)
    para = doc.add_paragraph()
    para.add_run('Input:').bold = True
    add_bullet_list(doc, [
        'Category allocations (from Step 4)',
        'Package data (from Step 2)',
        'Calculated prices (from Step 3)'
    ])
    
    para = doc.add_paragraph()
    para.add_run('Process:').bold = True
    para = doc.add_paragraph('For each category with allocation:')
    
    para = doc.add_paragraph('1. Filter packages within budget:')
    filter_code = """For each package:
  if (calculated_price >= allocated_amount * 0.8 AND 
      calculated_price <= allocated_amount * 1.2):
    include in candidates"""
    add_code_block(doc, filter_code)
    
    para = doc.add_paragraph('2. Score each candidate:')
    scoring_code = """Score = (
  price_fit_score * 0.3 +      // How well price fits budget
  rating_score * 0.3 +          // Vendor rating (0-5)
  experience_score * 0.2 +     // Years of experience
  verified_score * 0.1 +        // Verified status
  package_match_score * 0.1     // Package features match
)"""
    add_code_block(doc, scoring_code)
    
    para = doc.add_paragraph('3. Sort by score and return top 3-5')
    
    para = doc.add_paragraph()
    para.add_run('Output:').bold = True
    add_bullet_list(doc, [
        'Top vendor suggestions per category',
        'Package details',
        'Match scores',
        'Price comparison'
    ])
    
    add_heading(doc, 'Workflow Step 6: Validation & Finalization', 2)
    para = doc.add_paragraph()
    para.add_run('Input:').bold = True
    add_bullet_list(doc, [
        'All allocations',
        'Vendor suggestions',
        'Total budget'
    ])
    
    para = doc.add_paragraph()
    para.add_run('Process:').bold = True
    add_numbered_list(doc, [
        'Sum all allocations',
        'Check if total ≤ budget',
        'If over budget:',
        '  • Reduce non-essential categories proportionally',
        '  • Or suggest increasing budget',
        'Add buffer (10-15%)',
        'Calculate remaining budget',
        'Generate alternative scenarios (±10%, ±20%)'
    ])
    
    para = doc.add_paragraph()
    para.add_run('Output:').bold = True
    add_bullet_list(doc, [
        'Final validated breakdown',
        'Buffer amount',
        'Remaining budget',
        'Alternative scenarios'
    ])
    
    doc.add_page_break()
    
    # 5. Data Structures
    add_heading(doc, '5. Data Structures', 1)
    
    add_heading(doc, 'Input Structure:', 2)
    input_struct = """BudgetBreakdownRequest {
  totalBudget: number;           // e.g., 500000
  eventType: string;             // "Wedding" or eventTypeId
  guestCount: number;            // e.g., 200
  city: string;                  // "Mumbai"
  state: string;                 // "Maharashtra"
  eventDate?: string;            // Optional: "2024-12-15"
  eventDuration?: number;        // Optional: hours
  preferences?: {
    priorityCategories?: string[];  // Categories to prioritize
    excludeCategories?: string[];    // Categories to exclude
    customAllocations?: {            // Override AI allocation
      [categoryId: string]: number;  // Custom amount
    };
  };
}"""
    add_code_block(doc, input_struct)
    
    add_heading(doc, 'Output Structure:', 2)
    output_struct = """BudgetBreakdownResponse {
  breakdown: {
    totalBudget: number;
    totalAllocated: number;
    buffer: number;
    bufferPercentage: number;
    remaining: number;
    categories: CategoryAllocation[];
  };
  vendorSuggestions: {
    [categoryId: string]: VendorSuggestion[];
  };
  recommendations: string[];
  alternativeScenarios?: {
    budgetPlus10: BudgetBreakdown;
    budgetPlus20: BudgetBreakdown;
    budgetMinus10: BudgetBreakdown;
    budgetMinus20: BudgetBreakdown;
  };
  metadata: {
    confidence: number;
    dataQuality: 'high' | 'medium' | 'low';  // Based on package count
    pricingHistoryAvailable: boolean;
  };
}

CategoryAllocation {
  categoryId: string;
  categoryName: string;
  allocatedAmount: number;
  percentage: number;
  priceRange: {
    min: number;      // From vendor packages
    max: number;      // From vendor packages
    average: number;  // From vendor packages
    median: number;   // From vendor packages
  };
  availableVendors: number;
  pricingModel: 'fixed' | 'per_person' | 'hourly' | 'custom';
  reasoning: string;
  isRequired: boolean;
}

VendorSuggestion {
  businessId: string;
  businessName: string;
  packageId: string;
  packageName: string;
  calculatedPrice: number;
  originalPrice: number;
  discountApplied?: number;
  matchScore: number;  // 0-100
  rating: number;
  yearsExperience: number;
  verified: boolean;
  includedServices: string[];
  city: string;
}"""
    add_code_block(doc, output_struct)
    
    doc.add_page_break()
    
    # 6. Pricing Calculation Examples
    add_heading(doc, '6. Pricing Calculation Examples', 1)
    
    add_heading(doc, 'Example 1: Catering (Per Person)', 2)
    example1 = """Input:
  - Guest Count: 200
  - City: Mumbai
  - Package: base_price = ₹500, package_type = 'per_person'

Calculation:
  Base Price = ₹500 × 200 = ₹100,000
  Location Multiplier (Mumbai = Tier 1) = 1.3
  Adjusted Price = ₹100,000 × 1.3 = ₹130,000
  
  If min_capacity = 150 and guest_count = 200:
    Price = ₹500 × 200 = ₹100,000 ✓
  
  If min_capacity = 250 and guest_count = 200:
    Price = ₹500 × 250 = ₹125,000 (minimum charge)"""
    add_code_block(doc, example1)
    
    add_heading(doc, 'Example 2: Photography (Fixed + Hourly)', 2)
    example2 = """Input:
  - Duration: 8 hours
  - City: Pune
  - Package: base_price = ₹30,000, package_type = 'fixed'

Calculation:
  Price = ₹30,000 (fixed)
  Location Multiplier (Pune = Tier 2) = 1.1
  Adjusted Price = ₹30,000 × 1.1 = ₹33,000"""
    add_code_block(doc, example2)
    
    add_heading(doc, 'Example 3: Makeup Artist (Fixed, Guest Count Affected)', 2)
    example3 = """Input:
  - Guest Count: 5 (bride + 4 family members)
  - City: Delhi
  - Package: base_price = ₹15,000, package_type = 'fixed'
  - Note: Multiple artists may be needed

Calculation:
  Base Price = ₹15,000 (per artist)
  Estimated Artists Needed = ceil(5 / 2) = 3 artists
  Total Price = ₹15,000 × 3 = ₹45,000
  Location Multiplier (Delhi = Tier 1) = 1.2
  Adjusted Price = ₹45,000 × 1.2 = ₹54,000"""
    add_code_block(doc, example3)
    
    doc.add_page_break()
    
    # 7. AI Allocation Logic
    add_heading(doc, '7. AI Allocation Logic (Detailed)', 1)
    
    add_heading(doc, 'AI Decision Process:', 2)
    add_numbered_list(doc, [
        'Category Prioritization:',
        '  • Required categories get priority allocation',
        '  • Optional categories get remaining budget',
        'Price Range Validation:',
        '  • If allocated amount < min price: Increase allocation',
        '  • If allocated amount > max price: Decrease allocation',
        '  • If no packages available: Use industry standard',
        'Budget Distribution:',
        '  • For required categories:',
        '    - Allocate based on:',
        '      • Price range availability (50% weight)',
        '      • Industry standards (30% weight)',
        '      • Event type factors (20% weight)',
        '  • For optional categories:',
        '    • Allocate remaining budget proportionally',
        'Buffer Management:',
        '  • Calculate 10-15% buffer',
        '  • Distribute buffer across categories or keep separate',
        '  • Ensure total doesn\'t exceed budget'
    ])
    
    doc.add_page_break()
    
    # 8. Evolution Path
    add_heading(doc, '8. Evolution Path (When Pricing History Becomes Available)', 1)
    
    add_heading(doc, 'Phase 1: Package-Only (Current)', 2)
    para = doc.add_paragraph()
    para.add_run('Data Source: ').bold = True
    para.add_run('vendor_business_pricing_packages')
    para = doc.add_paragraph()
    para.add_run('Accuracy: ').bold = True
    para.add_run('Medium (based on listed prices)')
    para = doc.add_paragraph()
    para.add_run('Confidence: ').bold = True
    para.add_run('0.6-0.7')
    
    add_heading(doc, 'Phase 2: Package + Limited History (3-6 months)', 2)
    para = doc.add_paragraph()
    para.add_run('Data Source:').bold = True
    add_bullet_list(doc, [
        'vendor_business_pricing_packages (primary)',
        'vendor_pricing_history (secondary, limited data)'
    ])
    para = doc.add_paragraph()
    para.add_run('Enhancement:').bold = True
    add_bullet_list(doc, [
        'Compare listed prices vs actual booking prices',
        'Identify discount patterns',
        'Adjust price ranges based on actuals'
    ])
    para = doc.add_paragraph()
    para.add_run('Accuracy: ').bold = True
    para.add_run('Medium-High')
    para = doc.add_paragraph()
    para.add_run('Confidence: ').bold = True
    para.add_run('0.7-0.8')
    
    add_heading(doc, 'Phase 3: Package + Rich History (6+ months)', 2)
    para = doc.add_paragraph()
    para.add_run('Data Source:').bold = True
    add_bullet_list(doc, [
        'vendor_business_pricing_packages',
        'vendor_pricing_history (rich data)',
        'Booking patterns',
        'Seasonal trends'
    ])
    para = doc.add_paragraph()
    para.add_run('Enhancement:').bold = True
    add_bullet_list(doc, [
        'Predictive pricing',
        'Seasonal adjustments',
        'Location-specific trends',
        'Vendor-specific patterns'
    ])
    para = doc.add_paragraph()
    para.add_run('Accuracy: ').bold = True
    para.add_run('High')
    para = doc.add_paragraph()
    para.add_run('Confidence: ').bold = True
    para.add_run('0.8-0.9')
    
    doc.add_page_break()
    
    # 9. Error Handling
    add_heading(doc, '9. Error Handling & Edge Cases', 1)
    
    add_heading(doc, 'Edge Cases:', 2)
    
    para = doc.add_paragraph()
    para.add_run('1. No Packages Available for Category:').bold = True
    add_bullet_list(doc, [
        'Use industry standard percentage',
        'Flag as "estimated" in response',
        'Lower confidence score'
    ])
    
    para = doc.add_paragraph()
    para.add_run('2. Insufficient Budget:').bold = True
    add_bullet_list(doc, [
        'Suggest minimum viable budget',
        'Highlight which categories can\'t be covered',
        'Offer alternative scenarios'
    ])
    
    para = doc.add_paragraph()
    para.add_run('3. Location Not Found:').bold = True
    add_bullet_list(doc, [
        'Use default location multiplier (1.0)',
        'Flag in metadata'
    ])
    
    para = doc.add_paragraph()
    para.add_run('4. Guest Count Mismatch:').bold = True
    add_bullet_list(doc, [
        'For per_person: Use minimum capacity if below',
        'For fixed: Use as-is',
        'Warn if guest count exceeds max_capacity'
    ])
    
    para = doc.add_paragraph()
    para.add_run('5. All Packages Out of Budget:').bold = True
    add_bullet_list(doc, [
        'Suggest increasing budget',
        'Show cheapest available option',
        'Recommend alternative locations'
    ])
    
    doc.add_page_break()
    
    # 10. Performance Considerations
    add_heading(doc, '10. Performance Considerations', 1)
    
    add_heading(doc, 'Optimization Strategies:', 2)
    
    para = doc.add_paragraph()
    para.add_run('1. Caching:').bold = True
    add_bullet_list(doc, [
        'Cache category price aggregations (refresh daily)',
        'Cache AI allocations for common scenarios',
        'Cache vendor package queries'
    ])
    
    para = doc.add_paragraph()
    para.add_run('2. Query Optimization:').bold = True
    add_bullet_list(doc, [
        'Index on: category_id, city, is_active, package_type',
        'Pre-aggregate price statistics',
        'Use materialized views for common queries'
    ])
    
    para = doc.add_paragraph()
    para.add_run('3. AI Optimization:').bold = True
    add_bullet_list(doc, [
        'Batch similar requests',
        'Cache common allocation patterns',
        'Use cheaper models for simple cases'
    ])
    
    doc.add_page_break()
    
    # 11. Integration Points
    add_heading(doc, '11. Integration Points', 1)
    
    add_heading(doc, 'Where Budget Breakdown Fits:', 2)
    
    para = doc.add_paragraph()
    para.add_run('1. Customer-Facing (Website/App):').bold = True
    add_bullet_list(doc, [
        'Event planning tool',
        'Vendor discovery with budget filter',
        'Quote request form'
    ])
    
    para = doc.add_paragraph()
    para.add_run('2. Vendor-Facing (Vendor App):').bold = True
    add_bullet_list(doc, [
        'Lead qualification (budget fit)',
        'Quote suggestions',
        'Package pricing guidance'
    ])
    
    para = doc.add_paragraph()
    para.add_run('3. Admin Portal:').bold = True
    add_bullet_list(doc, [
        'Market analysis',
        'Pricing insights',
        'Category performance'
    ])
    
    doc.add_page_break()
    
    # 12. Success Metrics
    add_heading(doc, '12. Success Metrics', 1)
    
    add_bullet_list(doc, [
        'Accuracy: Allocations within ±15% of actual bookings',
        'Coverage: 80%+ of categories have vendor matches',
        'User satisfaction: 70%+ users find breakdown helpful',
        'Conversion: 20%+ increase in quote requests'
    ])
    
    # Footer
    doc.add_paragraph()
    para = doc.add_paragraph()
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para.style.font.size = Pt(9)
    para.style.font.italic = True
    para.add_run('Document generated for BookMyVendor Budget Breakdown Solution Architecture')
    
    # Save document
    output_file = 'Budget_Breakdown_Solution_Architecture.docx'
    doc.save(output_file)
    print(f"Word document created successfully: {output_file}")

if __name__ == '__main__':
    main()
