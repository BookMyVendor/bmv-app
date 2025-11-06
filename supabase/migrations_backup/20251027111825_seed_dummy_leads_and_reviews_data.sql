/*
  # Seed Dummy Data for Leads and Reviews

  ## Summary
  Populates the database with realistic dummy data for testing and previewing the UI functionality.
  This migration adds sample leads and reviews with varied characteristics to demonstrate all features.

  ## Data Added

  ### Businesses
  - Creates 2 additional businesses with different service categories
  - Covers Wedding Planner, Caterer, and Photographer services
  - Includes businesses in Mumbai, Delhi, and Bangalore for location testing

  ### Leads (20 entries)
  - Varied event types: Wedding, Birthday, Corporate, Anniversary, Engagement, Baby Shower
  - Mixed statuses: new, contacted, closed
  - Distributed across multiple cities: Mumbai, Delhi, Bangalore, Pune, Chennai
  - Different time periods: recent leads, older leads, future event dates
  - Realistic customer information and messages

  ### Reviews (25 entries)
  - Rating distribution: Emphasis on 4-5 stars with some lower ratings
  - Mix of short and detailed review comments
  - Some reviews with vendor responses, others without
  - Various event types for context
  - Timestamps spread across last 6 months

  ## Notes
  - All data is linked to existing user (dd673e85-eb12-4043-93a0-23adb5acc91e)
  - Businesses are marked as verified to appear in public views
  - Data respects all foreign key relationships
  - Designed to test filtering, sorting, and search functionality
*/

-- Insert additional dummy businesses
INSERT INTO businesses (id, user_id, business_name, contact_person_name, email, phone_number, vendor_service_category, event_types, business_description, years_of_experience, business_address, city, state, is_verified, instagram_url, cover_photo_url, created_at) VALUES
('b1111111-1111-1111-1111-111111111111', 'dd673e85-eb12-4043-93a0-23adb5acc91e', 'Dream Weddings & Events', 'Priya Sharma', 'contact@dreamweddings.com', '+91-9876543210', 'Wedding Planner', ARRAY['Wedding', 'Engagement', 'Anniversary'], 'Premier wedding planning service specializing in luxury destination weddings and intimate celebrations. We turn your dreams into unforgettable memories.', '10+ years', '42 MG Road, Connaught Place', 'Delhi', 'Delhi', true, 'https://instagram.com/dreamweddings', 'https://images.pexels.com/photos/1444442/pexels-photo-1444442.jpeg', NOW() - INTERVAL '6 months'),
('b2222222-2222-2222-2222-222222222222', 'dd673e85-eb12-4043-93a0-23adb5acc91e', 'Spice Paradise Catering', 'Rajesh Kumar', 'info@spiceparadise.com', '+91-9988776655', 'Caterer', ARRAY['Wedding', 'Corporate', 'Birthday', 'Baby Shower'], 'Award-winning catering service offering authentic Indian cuisine and international delicacies. From intimate gatherings to grand celebrations, we serve excellence.', '5-10 years', '156 Brigade Road', 'Bangalore', 'Karnataka', true, 'https://instagram.com/spiceparadise', 'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg', NOW() - INTERVAL '8 months')
ON CONFLICT (id) DO NOTHING;

-- Insert dummy leads (20 total)
INSERT INTO leads (business_id, customer_name, customer_email, customer_phone, event_type, event_date, city, message, status, created_at) VALUES
-- Recent New Leads
('b1111111-1111-1111-1111-111111111111', 'Ananya Patel', 'ananya.patel@gmail.com', '+91-9876543211', 'Wedding', '2025-12-15', 'Mumbai', 'Looking for a complete wedding planning package for 500 guests. Venue should be in Mumbai. Budget is flexible for the right service.', 'new', NOW() - INTERVAL '2 hours'),
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Vikram Singh', 'vikram.singh@outlook.com', '+91-9876543212', 'Wedding', '2026-02-20', 'Delhi', 'Need pre-wedding and wedding day photography coverage. Looking for candid style photographer.', 'new', NOW() - INTERVAL '5 hours'),
('b2222222-2222-2222-2222-222222222222', 'Meera Reddy', 'meera.reddy@yahoo.com', '+91-9876543213', 'Corporate', '2025-11-30', 'Bangalore', 'Corporate annual day event for 200 employees. Need full catering service including setup and service staff.', 'new', NOW() - INTERVAL '1 day'),
('b1111111-1111-1111-1111-111111111111', 'Arjun Malhotra', 'arjun.m@gmail.com', '+91-9876543214', 'Engagement', '2026-01-10', 'Pune', 'Planning an engagement ceremony for 150 people. Would like to discuss decoration and coordination services.', 'new', NOW() - INTERVAL '2 days'),
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Sneha Kapoor', 'sneha.kapoor@gmail.com', '+91-9876543215', 'Birthday', '2025-11-25', 'Mumbai', 'Looking for photography coverage for my daughter''s 5th birthday party. About 3-4 hours needed.', 'new', NOW() - INTERVAL '3 days'),

-- Contacted Leads
('b2222222-2222-2222-2222-222222222222', 'Rohit Sharma', 'rohit.sharma99@gmail.com', '+91-9876543216', 'Wedding', '2026-03-15', 'Delhi', 'Need catering for wedding reception with 800 guests. Preference for North Indian and Continental menu.', 'contacted', NOW() - INTERVAL '5 days'),
('b1111111-1111-1111-1111-111111111111', 'Divya Nair', 'divya.nair@rediffmail.com', '+91-9876543217', 'Wedding', '2025-12-28', 'Chennai', 'Destination wedding in Goa. Need complete planning and coordination services for 3 days.', 'contacted', NOW() - INTERVAL '7 days'),
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Karan Verma', 'karan.verma@gmail.com', '+91-9876543218', 'Corporate', '2025-11-20', 'Bangalore', 'Product launch event photography needed. Professional coverage for 6 hours.', 'contacted', NOW() - INTERVAL '10 days'),
('b2222222-2222-2222-2222-222222222222', 'Pooja Gupta', 'pooja.gupta@yahoo.com', '+91-9876543219', 'Birthday', '2025-11-28', 'Mumbai', 'Kids birthday party catering for 50 children and 30 adults. Theme is princess party.', 'contacted', NOW() - INTERVAL '12 days'),
('b1111111-1111-1111-1111-111111111111', 'Amit Desai', 'amit.desai@hotmail.com', '+91-9876543220', 'Anniversary', '2026-01-20', 'Pune', 'Planning 25th wedding anniversary celebration for parents. Around 100 guests expected.', 'contacted', NOW() - INTERVAL '14 days'),

-- Older Contacted Leads
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Riya Joshi', 'riya.joshi@gmail.com', '+91-9876543221', 'Engagement', '2026-02-14', 'Delhi', 'Valentine''s Day engagement shoot needed. Outdoor locations preferred.', 'contacted', NOW() - INTERVAL '20 days'),
('b2222222-2222-2222-2222-222222222222', 'Sanjay Mehta', 'sanjay.mehta@gmail.com', '+91-9876543222', 'Corporate', '2025-12-10', 'Bangalore', 'Year-end office party catering for 150 people. Mix of veg and non-veg required.', 'contacted', NOW() - INTERVAL '25 days'),
('b1111111-1111-1111-1111-111111111111', 'Neha Agarwal', 'neha.agarwal@yahoo.com', '+91-9876543223', 'Baby Shower', '2025-11-18', 'Mumbai', 'Baby shower event planning needed for 80 guests. Looking for elegant theme decoration.', 'contacted', NOW() - INTERVAL '30 days'),

-- Closed Leads
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Rahul Khanna', 'rahul.khanna@outlook.com', '+91-9876543224', 'Wedding', '2025-10-15', 'Chennai', 'Wedding photography package booked. Thanks for the detailed quote and portfolio!', 'closed', NOW() - INTERVAL '45 days'),
('b2222222-2222-2222-2222-222222222222', 'Kavita Rao', 'kavita.rao@gmail.com', '+91-9876543225', 'Corporate', '2025-09-25', 'Mumbai', 'Finalized catering for our corporate event. Great menu options!', 'closed', NOW() - INTERVAL '50 days'),
('b1111111-1111-1111-1111-111111111111', 'Manish Pandey', 'manish.pandey@rediffmail.com', '+91-9876543226', 'Wedding', '2025-10-05', 'Delhi', 'Wedding planning services confirmed. Very professional team!', 'closed', NOW() - INTERVAL '60 days'),
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Simran Kaur', 'simran.kaur@gmail.com', '+91-9876543227', 'Engagement', '2025-09-10', 'Pune', 'Engagement shoot completed. Loved the results!', 'closed', NOW() - INTERVAL '70 days'),
('b2222222-2222-2222-2222-222222222222', 'Deepak Chopra', 'deepak.chopra@yahoo.com', '+91-9876543228', 'Birthday', '2025-08-20', 'Bangalore', 'Birthday party catering was excellent. Thanks!', 'closed', NOW() - INTERVAL '80 days'),
('b1111111-1111-1111-1111-111111111111', 'Priyanka Shah', 'priyanka.shah@gmail.com', '+91-9876543229', 'Wedding', '2025-08-01', 'Mumbai', 'Wedding completed successfully. Highly recommended!', 'closed', NOW() - INTERVAL '90 days'),
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Aditya Verma', 'aditya.verma@hotmail.com', '+91-9876543230', 'Corporate', '2025-07-15', 'Delhi', 'Corporate event photography was perfect. Thank you!', 'closed', NOW() - INTERVAL '100 days');

-- Insert dummy reviews (25 total)
INSERT INTO reviews (business_id, customer_name, profile_photo_url, rating, comment, event_type, vendor_response, responded_at, created_at) VALUES
-- 5-Star Reviews with responses
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Rahul Khanna', NULL, 5, 'Outstanding photography service! The team captured every precious moment of our wedding beautifully. The candid shots are absolutely stunning. Highly professional and creative.', 'Wedding', 'Thank you so much for your kind words! It was an honor to be part of your special day. Wishing you both a lifetime of happiness!', NOW() - INTERVAL '40 days', NOW() - INTERVAL '45 days'),
('b1111111-1111-1111-1111-111111111111', 'Manish Pandey', NULL, 5, 'Dream Weddings truly made our wedding day perfect! From planning to execution, everything was flawless. Priya and her team are incredibly organized and attentive to details.', 'Wedding', 'We''re thrilled we could make your wedding day so special! Thank you for trusting us with your celebration.', NOW() - INTERVAL '55 days', NOW() - INTERVAL '60 days'),
('b2222222-2222-2222-2222-222222222222', 'Kavita Rao', NULL, 5, 'Exceptional catering service! The food was delicious and presentation was impeccable. All our guests couldn''t stop praising the variety and taste. Highly recommended!', 'Corporate', 'Thank you for the wonderful feedback! We''re delighted that your guests enjoyed the food. Looking forward to serving you again!', NOW() - INTERVAL '45 days', NOW() - INTERVAL '50 days'),
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Simran Kaur', NULL, 5, 'Amazing engagement shoot experience! The photographer made us feel so comfortable and the locations chosen were perfect. We absolutely love all our photos!', 'Engagement', 'It was wonderful working with you both! Your chemistry made our job easy. Congratulations again on your engagement!', NOW() - INTERVAL '65 days', NOW() - INTERVAL '70 days'),

-- 5-Star Reviews without responses
('b1111111-1111-1111-1111-111111111111', 'Anita Deshmukh', NULL, 5, 'Exceeded all our expectations! The wedding planning was stress-free because of their professional approach. Every detail was perfectly executed.', 'Wedding', NULL, NULL, NOW() - INTERVAL '35 days'),
('b2222222-2222-2222-2222-222222222222', 'Suresh Iyer', NULL, 5, 'Best catering service in town! The menu was diverse and accommodated all dietary requirements. Staff was courteous and efficient.', 'Wedding', NULL, NULL, NOW() - INTERVAL '28 days'),
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Anjali Mehta', NULL, 5, 'Incredible photography skills! Every photo tells a story. The editing and album quality is top-notch.', 'Birthday', NULL, NULL, NOW() - INTERVAL '15 days'),

-- 4-Star Reviews with responses
('b1111111-1111-1111-1111-111111111111', 'Ravi Patel', NULL, 4, 'Great wedding planning service! Very professional team. Only minor suggestion would be to have more frequent updates during the planning phase.', 'Wedding', 'Thank you for your valuable feedback! We''re working on improving our communication frequency. Glad we could make your wedding beautiful!', NOW() - INTERVAL '75 days', NOW() - INTERVAL '80 days'),
('b2222222-2222-2222-2222-222222222222', 'Deepak Chopra', NULL, 4, 'Very good catering service. Food was tasty and fresh. The only issue was a slight delay in setup, but overall great experience!', 'Birthday', 'Thank you for bringing this to our attention. We apologize for the delay and have taken steps to ensure better timing. We appreciate your business!', NOW() - INTERVAL '75 days', NOW() - INTERVAL '80 days'),

-- 4-Star Reviews without responses
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Meera Jain', NULL, 4, 'Good photography service. Captured most important moments well. Would have liked more variety in poses for formal shots.', 'Corporate', NULL, NULL, NOW() - INTERVAL '22 days'),
('b1111111-1111-1111-1111-111111111111', 'Karthik Ramesh', NULL, 4, 'Solid event planning. Team was responsive and handled most things smoothly. A few last-minute hiccups but overall satisfied.', 'Engagement', NULL, NULL, NOW() - INTERVAL '42 days'),
('b2222222-2222-2222-2222-222222222222', 'Nisha Gupta', NULL, 4, 'Food quality was excellent. Portion sizes were generous. Slight room for improvement in dessert variety.', 'Corporate', NULL, NULL, NOW() - INTERVAL '18 days'),

-- 3-Star Reviews
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Vikram Malhotra', NULL, 3, 'Average experience. Photos were decent but expected more creativity. Delivery time was longer than promised.', 'Wedding', NULL, NULL, NOW() - INTERVAL '95 days'),
('b1111111-1111-1111-1111-111111111111', 'Shreya Kulkarni', NULL, 3, 'Service was okay. Some coordination issues on the event day. Team was friendly but could be more organized.', 'Anniversary', NULL, NULL, NOW() - INTERVAL '68 days'),
('b2222222-2222-2222-2222-222222222222', 'Arjun Shetty', NULL, 3, 'Food was good but service could be faster. Some items ran out before all guests were served.', 'Baby Shower', NULL, NULL, NOW() - INTERVAL '52 days'),

-- More 5-Star Reviews (Recent)
('b1111111-1111-1111-1111-111111111111', 'Tanvi Sharma', NULL, 5, 'Absolutely wonderful experience! The team went above and beyond to make our event special. Every detail was perfect!', 'Wedding', 'Your kind words mean the world to us! It was a pleasure creating your dream wedding.', NOW() - INTERVAL '3 days', NOW() - INTERVAL '8 days'),
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Rohan Kapoor', NULL, 5, 'Fantastic photography work! Very professional and creative. The photos captured the emotions perfectly.', 'Engagement', NULL, NULL, NOW() - INTERVAL '12 days'),
('b2222222-2222-2222-2222-222222222222', 'Priya Reddy', NULL, 5, 'Outstanding catering! Guests are still talking about how delicious everything was. Will definitely hire again.', 'Corporate', NULL, NULL, NOW() - INTERVAL '6 days'),

-- More 4-Star Reviews (Recent)
('b1111111-1111-1111-1111-111111111111', 'Siddharth Nair', NULL, 4, 'Very good planning service. Team was helpful and accommodating. Minor improvements needed in timeline management.', 'Wedding', NULL, NULL, NOW() - INTERVAL '20 days'),
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Ishita Singh', NULL, 4, 'Good photography work. Happy with the final album. Would recommend to friends.', 'Birthday', NULL, NULL, NOW() - INTERVAL '25 days'),
('b2222222-2222-2222-2222-222222222222', 'Amit Agarwal', NULL, 4, 'Reliable catering service. Food quality was consistent throughout the event. Good value for money.', 'Wedding', NULL, NULL, NOW() - INTERVAL '32 days'),

-- Additional Mixed Ratings
('b1111111-1111-1111-1111-111111111111', 'Pooja Saxena', NULL, 5, 'Incredible service from start to finish! Made our special day truly magical. Thank you!', 'Anniversary', NULL, NULL, NOW() - INTERVAL '48 days'),
('8e34f57d-fbad-4205-aa9d-4682fe160996', 'Nikhil Bajaj', NULL, 5, 'Best decision we made for our wedding! The photos are breathtaking and worth every penny.', 'Wedding', 'Thank you so much! It was an honor to document your beautiful wedding.', NOW() - INTERVAL '10 days', NOW() - INTERVAL '16 days'),
('b2222222-2222-2222-2222-222222222222', 'Ritika Choudhary', NULL, 4, 'Great catering experience. Staff was professional and food was fresh. Will use again for future events.', 'Baby Shower', NULL, NULL, NOW() - INTERVAL '38 days'),
('b1111111-1111-1111-1111-111111111111', 'Varun Khanna', NULL, 5, 'Phenomenal work! Every aspect of our wedding was handled perfectly. Couldn''t have asked for better!', 'Wedding', NULL, NULL, NOW() - INTERVAL '5 days');
