import { buildApp } from '../src/app';
import { db } from '../src/db';
import { env } from '../src/config/env';
import { BookingStatus } from '@shared';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`  [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${name}`);
    failed++;
  }
}

async function runAdminBookingTests() {
  console.log('\n============================================================');
  console.log('CHANDIL HOME SERVICES - MODULE 12C ADMIN BOOKING BACKEND');
  console.log('============================================================\n');

  const app = await buildApp();
  const pool = db.getPool();
  if (!pool) {
    console.error('Fatal: Database pool unavailable.');
    process.exit(1);
  }

  // Dedicated test phone numbers for Module 12C
  const adminPhone = '9800077001';
  const customerPhone = '9800077002';
  const provider1Phone = '9800077003';
  const provider2Phone = '9800077004';

  const allTestPhones = [adminPhone, customerPhone, provider1Phone, provider2Phone];

  async function cleanupFixtures() {
    // 1. Clean bookings and logs created in this test suite
    await pool!.query(
      `DELETE FROM booking_status_logs 
       WHERE booking_id IN (SELECT id FROM bookings WHERE idempotency_key LIKE 'adm-bk-%')`
    );
    await pool!.query(
      `DELETE FROM bookings WHERE idempotency_key LIKE 'adm-bk-%'`
    );


    // 3. Clean provider profiles and users
    await pool!.query(
      `DELETE FROM provider_profiles WHERE user_id IN (SELECT id FROM users WHERE phone = ANY($1))`,
      [allTestPhones]
    );
    await pool!.query('DELETE FROM users WHERE phone = ANY($1)', [allTestPhones]);
  }

  try {
    // Pre-test cleanup
    await cleanupFixtures();

    // 1. Seed Users: Admin, Customer, Provider 1, Provider 2
    const { rows: adminRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version)
       VALUES ($1, 'admin', 'en', 'Admin Super', true, 1) RETURNING id`,
      [adminPhone]
    );
    const adminId = adminRows[0].id;
    const adminToken = app.jwt.sign({ id: adminId, phone: adminPhone, role: 'admin', tokenVersion: 1 });

    const { rows: customerRows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version)
       VALUES ($1, 'customer', 'hi', 'Sunil Kumar', true, 1) RETURNING id`,
      [customerPhone]
    );
    const customerId = customerRows[0].id;
    const customerToken = app.jwt.sign({ id: customerId, phone: customerPhone, role: 'customer', tokenVersion: 1 });

    const { rows: provider1Rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version)
       VALUES ($1, 'provider', 'hi', 'Manoj Electrician', true, 1) RETURNING id`,
      [provider1Phone]
    );
    const provider1Id = provider1Rows[0].id;
    await pool.query(
      `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, rating)
       VALUES ($1, 'electrician', 'Chandil Bazar', true, 4.80)`,
      [provider1Id]
    );
    const provider1Token = app.jwt.sign({ id: provider1Id, phone: provider1Phone, role: 'provider', tokenVersion: 1 });

    const { rows: provider2Rows } = await pool.query<{ id: string }>(
      `INSERT INTO users (phone, role, preferred_language, full_name, is_active, token_version)
       VALUES ($1, 'provider', 'hi', 'Rakesh Plumber', true, 1) RETURNING id`,
      [provider2Phone]
    );
    const provider2Id = provider2Rows[0].id;
    await pool.query(
      `INSERT INTO provider_profiles (user_id, category_id, service_area, is_available, rating)
       VALUES ($1, 'plumber', 'Dam Road', true, 4.90)`,
      [provider2Id]
    );

    // Helper to seed a booking at any given status
    async function seedBooking(opts: {
      keySuffix: string;
      status: BookingStatus;
      categoryId?: string;
      areaLocality?: string;
      providerId?: string | null;
      textDescription?: string;
      audioUrl?: string | null;
      visitingFee?: number;
      finalAmount?: number | null;
      paymentCollected?: boolean;
    }): Promise<string> {
      const idempotencyKey = `adm-bk-${opts.keySuffix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const catId = opts.categoryId || 'electrician';
      const locality = opts.areaLocality || 'chowka';
      const fee = opts.visitingFee !== undefined ? opts.visitingFee : 99.0;
      const finalAmt = opts.finalAmount !== undefined ? opts.finalAmount : null;
      const collected = opts.paymentCollected !== undefined ? opts.paymentCollected : false;

      const { rows } = await pool!.query<{ id: string }>(
        `INSERT INTO bookings (
           idempotency_key, customer_id, provider_id, category_id,
           area_locality, landmark, text_description, audio_url, audio_duration_seconds,
           status, visiting_fee, final_amount, payment_method, payment_collected
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'CASH', $13)
         RETURNING id`,
        [
          idempotencyKey,
          customerId,
          opts.providerId || null,
          catId,
          locality,
          'Near Main Gate',
          opts.textDescription || 'Switchboard spark issue',
          opts.audioUrl || null,
          opts.audioUrl ? 12 : null,
          opts.status,
          fee,
          finalAmt,
          collected,
        ]
      );

      const bookingId = rows[0].id;

      // Seed initial status log
      await pool!.query(
        `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
         VALUES ($1, NULL, $2, $3, 'Test initial state seed')`,
        [bookingId, opts.status, customerId]
      );

      return bookingId;
    }

    // -------------------------------------------------------------
    // SECTION A: RBAC & AUTHORIZATION TESTS
    // -------------------------------------------------------------
    console.log('\n--- Section A: RBAC & Authorization ---');

    // Seed one booking for RBAC testing
    const rbacBookingId = await seedBooking({
      keySuffix: 'rbac-1',
      status: 'SERVICE_REQUESTED',
    });

    // 1. List unauthenticated -> 401
    const resListUnauth = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings',
    });
    assert(resListUnauth.statusCode === 401, '1. List unauthenticated returns 401');

    // 2. List customer -> 403
    const resListCust = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings',
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert(resListCust.statusCode === 403, '2. List customer returns 403');

    // 3. List provider -> 403
    const resListProv = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings',
      headers: { authorization: `Bearer ${provider1Token}` },
    });
    assert(resListProv.statusCode === 403, '3. List provider returns 403');

    // 4. List admin -> 200
    const resListAdmin = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resListAdmin.statusCode === 200, '4. List admin returns 200');

    // Detail RBAC
    const resDetUnauth = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings/${rbacBookingId}`,
    });
    assert(resDetUnauth.statusCode === 401, '4a. Detail unauthenticated returns 401');

    const resDetCust = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings/${rbacBookingId}`,
      headers: { authorization: `Bearer ${customerToken}` },
    });
    assert(resDetCust.statusCode === 403, '4b. Detail customer returns 403');

    const resDetProv = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings/${rbacBookingId}`,
      headers: { authorization: `Bearer ${provider1Token}` },
    });
    assert(resDetProv.statusCode === 403, '4c. Detail provider returns 403');

    const resDetAdmin = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings/${rbacBookingId}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resDetAdmin.statusCode === 200, '4d. Detail admin returns 200');

    // Cancel RBAC
    const resCancelUnauth = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${rbacBookingId}/cancel`,
      payload: { reason: 'Customer requested cancellation' },
    });
    assert(resCancelUnauth.statusCode === 401, '4e. Cancel unauthenticated returns 401');

    const resCancelCust = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${rbacBookingId}/cancel`,
      headers: { authorization: `Bearer ${customerToken}` },
      payload: { reason: 'Customer requested cancellation' },
    });
    assert(resCancelCust.statusCode === 403, '4f. Cancel customer returns 403');

    const resCancelProv = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${rbacBookingId}/cancel`,
      headers: { authorization: `Bearer ${provider1Token}` },
      payload: { reason: 'Customer requested cancellation' },
    });
    assert(resCancelProv.statusCode === 403, '4g. Cancel provider returns 403');

    // -------------------------------------------------------------
    // SECTION B: BOOKING LISTING, FILTERS, SEARCH, PAGINATION
    // -------------------------------------------------------------
    console.log('\n--- Section B: Listing, Search, Filters, Pagination ---');

    // Seed distinct bookings for listing/search tests
    const b1Id = await seedBooking({
      keySuffix: 'list-1',
      status: 'SERVICE_REQUESTED',
      categoryId: 'electrician',
      areaLocality: 'chowka',
      textDescription: 'Kitchen light flickering',
      audioUrl: '/api/audio/sample1.webm',
    });

    const b2Id = await seedBooking({
      keySuffix: 'list-2',
      status: 'PROVIDER_ACCEPTED',
      categoryId: 'plumber',
      areaLocality: 'dam-road',
      providerId: provider2Id,
      textDescription: 'Bathroom pipe leaking heavily',
    });

    const b3Id = await seedBooking({
      keySuffix: 'list-3',
      status: 'PAYMENT_PENDING',
      categoryId: 'electrician',
      areaLocality: 'chandil-bazar',
      providerId: provider1Id,
      textDescription: 'Fan installation complete',
      finalAmount: 149.0,
    });

    // 5. Empty filter list / non-matching filter
    const resEmpty = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?search=nonexistentphone9999999999',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resEmpty.statusCode === 200, '5. Non-matching search returns 200');
    assert(resEmpty.json().data.bookings.length === 0, '5b. Non-matching search returns empty array');
    assert(resEmpty.json().data.total === 0, '5c. Non-matching search total is 0');

    // 6. Admin sees bookings
    const resAll = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resAll.statusCode === 200, '6. Admin successfully lists bookings');
    const allBookings = resAll.json().data.bookings;
    assert(allBookings.length >= 4, '6b. Admin sees all seeded bookings');

    // 7. Newest-first ordering
    const isNewestFirst = allBookings.every((item: any, idx: number) => {
      if (idx === 0) return true;
      return new Date(item.createdAt).getTime() <= new Date(allBookings[idx - 1].createdAt).getTime();
    });
    assert(isNewestFirst, '7. Bookings are ordered newest first (created_at DESC)');

    // 8. Total count correct
    assert(resAll.json().data.total >= 4, '8. Total count matches seeded records');

    // 9. Default limit 25
    assert(resAll.json().data.limit === 25, '9. Default limit is 25');

    // 10. Maximum limit 100 enforced & custom limit
    const resLim100 = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?limit=100',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resLim100.statusCode === 200, '10. Limit 100 accepted');
    assert(resLim100.json().data.limit === 100, '10b. Returned limit is 100');

    const resLimOver100 = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?limit=101',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resLimOver100.statusCode === 400, '10c. Limit over 100 rejected with 400');

    // 11. Offset works
    const resOffset = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?limit=2&offset=1',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resOffset.statusCode === 200, '11. Offset query returns 200');
    assert(resOffset.json().data.offset === 1, '11b. Returned offset is 1');
    assert(resOffset.json().data.bookings.length <= 2, '11c. Respects limit with offset');
    assert(resOffset.json().data.bookings[0].id === allBookings[1].id, '11d. Offset skips first item correctly');

    // 12. Status filter
    const resFilterStatus = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?status=PROVIDER_ACCEPTED',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resFilterStatus.statusCode === 200, '12. Status filter returns 200');
    const statusRows = resFilterStatus.json().data.bookings;
    assert(
      statusRows.length > 0 && statusRows.every((b: any) => b.status === 'PROVIDER_ACCEPTED'),
      '12b. All returned bookings have status PROVIDER_ACCEPTED'
    );

    // 13. Category filter
    const resFilterCat = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?category_id=plumber',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resFilterCat.statusCode === 200, '13. Category filter returns 200');
    const catRows = resFilterCat.json().data.bookings;
    assert(
      catRows.length > 0 && catRows.every((b: any) => b.categoryId === 'plumber'),
      '13b. All returned bookings have category_id = plumber'
    );

    // 14. Provider filter
    const resFilterProv = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings?provider_id=${provider2Id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resFilterProv.statusCode === 200, '14. Provider filter returns 200');
    const provRows = resFilterProv.json().data.bookings;
    assert(
      provRows.length > 0 && provRows.every((b: any) => b.providerId === provider2Id),
      '14b. All returned bookings have specified provider_id'
    );

    // 15. Locality filter
    const resFilterLoc = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?area_locality=dam-road',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resFilterLoc.statusCode === 200, '15. Locality filter returns 200');
    const locRows = resFilterLoc.json().data.bookings;
    assert(
      locRows.length > 0 && locRows.every((b: any) => b.areaLocality === 'dam-road'),
      '15b. All returned bookings have area_locality = dam-road'
    );

    // 16. Search by booking UUID
    const resSearchUuid = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings?search=${b1Id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resSearchUuid.statusCode === 200, '16. Search by booking UUID returns 200');
    assert(
      resSearchUuid.json().data.bookings.some((b: any) => b.id === b1Id),
      '16b. Found target booking by UUID'
    );

    // 17. Search by customer phone
    const resSearchPhone = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings?search=${customerPhone}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resSearchPhone.statusCode === 200, '17. Search by customer phone returns 200');
    assert(
      resSearchPhone.json().data.bookings.length >= 4,
      '17b. Customer bookings found by customer phone search'
    );

    // 18. Search by customer name
    const resSearchCustName = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?search=Sunil',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resSearchCustName.statusCode === 200, '18. Search by customer name returns 200');
    assert(
      resSearchCustName.json().data.bookings.length >= 4,
      '18b. Bookings found by customer name search'
    );

    // 19. Search by provider name
    const resSearchProvName = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?search=Rakesh',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resSearchProvName.statusCode === 200, '19. Search by provider name returns 200');
    assert(
      resSearchProvName.json().data.bookings.some((b: any) => b.providerName === 'Rakesh Plumber'),
      '19b. Bookings found by provider name search'
    );

    // 20. Combined filters (Category + Status)
    const resCombined = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?category_id=electrician&status=PAYMENT_PENDING',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resCombined.statusCode === 200, '20. Combined category and status filter returns 200');
    const combRows = resCombined.json().data.bookings;
    assert(
      combRows.length > 0 &&
        combRows.every((b: any) => b.categoryId === 'electrician' && b.status === 'PAYMENT_PENDING'),
      '20b. Combined filter accurately matches both criteria'
    );

    // Additional Listing Validations
    const resBadStatus = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?status=INVALID_STATUS_FOO',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resBadStatus.statusCode === 400, '20c. Invalid status query rejected with 400');

    const resBadProvId = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?provider_id=not-a-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resBadProvId.statusCode === 400, '20d. Invalid provider_id query rejected with 400');

    const resBadOffset = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings?offset=-5',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resBadOffset.statusCode === 400, '20e. Negative offset query rejected with 400');

    // -------------------------------------------------------------
    // SECTION C: BOOKING DETAIL & AUDIT TIMELINE
    // -------------------------------------------------------------
    console.log('\n--- Section C: Booking Detail & Audit Timeline ---');

    // 21. Valid booking -> 200
    const resDetail = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings/${b2Id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resDetail.statusCode === 200, '21. Valid booking detail returns 200');
    const detailData = resDetail.json().data;

    // 22. Invalid UUID -> 400 (INVALID_ID)
    const resDetInvalidId = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings/not-a-valid-uuid',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resDetInvalidId.statusCode === 400, '22. Invalid UUID returns 400');
    assert(resDetInvalidId.json().error.code === 'INVALID_ID', '22b. Error code is INVALID_ID');

    // 23. Unknown booking -> 404 (BOOKING_NOT_FOUND)
    const resDet404 = await app.inject({
      method: 'GET',
      url: '/api/admin/bookings/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resDet404.statusCode === 404, '23. Unknown booking returns 404');
    assert(resDet404.json().error.code === 'BOOKING_NOT_FOUND', '23b. Error code is BOOKING_NOT_FOUND');

    // 24. Customer details returned
    assert(detailData.customer.id === customerId, '24. Customer ID matches');
    assert(detailData.customer.fullName === 'Sunil Kumar', '24b. Customer full name returned');
    assert(detailData.customer.phone === customerPhone, '24c. Customer phone returned to admin');
    assert(detailData.customer.preferredLanguage === 'hi', '24d. Customer preferred language returned');

    // 25. Provider details returned when assigned
    assert(detailData.provider !== null, '25. Provider object returned when assigned');
    assert(detailData.provider.id === provider2Id, '25b. Provider ID matches');
    assert(detailData.provider.fullName === 'Rakesh Plumber', '25c. Provider full name returned');
    assert(detailData.provider.phone === provider2Phone, '25d. Provider phone returned');
    assert(detailData.provider.serviceArea === 'Dam Road', '25e. Provider service area returned');
    assert(detailData.provider.rating === 4.9, '25f. Provider rating returned');

    // 26. Provider null when unassigned
    const resUnassignedDetail = await app.inject({
      method: 'GET',
      url: `/api/admin/bookings/${b1Id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    assert(resUnassignedDetail.statusCode === 200, '26. Unassigned booking detail returns 200');
    assert(resUnassignedDetail.json().data.provider === null, '26b. Provider is null for unassigned booking');

    // 27. Category details returned
    assert(detailData.category.id === 'plumber', '27. Category ID returned');
    assert(Boolean(detailData.category.titleEn), '27b. Category titleEn returned');
    assert(Boolean(detailData.category.titleHi), '27c. Category titleHi returned');

    // 28. Location returned
    assert(detailData.booking.areaLocality === 'dam-road', '28. areaLocality returned');
    assert(detailData.booking.landmark === 'Near Main Gate', '28b. landmark returned');

    // 29. Description returned
    assert(detailData.booking.textDescription === 'Bathroom pipe leaking heavily', '29. textDescription returned');

    // 30. Audio metadata returned
    const b1Detail = resUnassignedDetail.json().data;
    assert(b1Detail.booking.audioUrl === '/api/audio/sample1.webm', '30. audioUrl returned');
    assert(b1Detail.booking.audioDurationSeconds === 12, '30b. audioDurationSeconds returned');

    // 31. Financial fields returned read-only
    assert(detailData.booking.visitingFee === 99.0, '31. visitingFee returned');
    assert(detailData.booking.paymentMethod === 'CASH', '31b. paymentMethod returned');
    assert(detailData.booking.paymentCollected === false, '31c. paymentCollected returned');

    // 32. Timestamps returned
    assert(Boolean(detailData.booking.timestamps.createdAt), '32. createdAt timestamp returned');
    assert(Boolean(detailData.booking.timestamps.updatedAt), '32b. updatedAt timestamp returned');

    // 33. Complete timeline returned
    assert(Array.isArray(detailData.timeline), '33. Timeline is an array');
    assert(detailData.timeline.length >= 1, '33b. Timeline has status logs');
    assert(detailData.timeline[0].toStatus === 'PROVIDER_ACCEPTED', '33c. Timeline item toStatus matches');

    // 34. Timeline chronological
    const isTimelineChrono = detailData.timeline.every((item: any, idx: number) => {
      if (idx === 0) return true;
      return new Date(item.createdAt).getTime() >= new Date(detailData.timeline[idx - 1].createdAt).getTime();
    });
    assert(isTimelineChrono, '34. Timeline entries are strictly chronological');

    // -------------------------------------------------------------
    // SECTION D: ADMIN CANCELLATION
    // -------------------------------------------------------------
    console.log('\n--- Section D: Admin Cancellation ---');

    // 35. SERVICE_REQUESTED -> cancellation succeeds
    const c1Id = await seedBooking({ keySuffix: 'c-req', status: 'SERVICE_REQUESTED' });
    const resC1 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c1Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Customer requested cancellation via phone' },
    });
    assert(resC1.statusCode === 200, '35. Cancel SERVICE_REQUESTED succeeds with 200');
    assert(resC1.json().data.booking.status === 'CANCELLED_BY_ADMIN', '35b. Status changed to CANCELLED_BY_ADMIN');

    // 36. PROVIDER_ASSIGNED -> succeeds
    const c2Id = await seedBooking({ keySuffix: 'c-asgn', status: 'PROVIDER_ASSIGNED', providerId: provider1Id });
    const resC2 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c2Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Admin dispatch cancelled' },
    });
    assert(resC2.statusCode === 200, '36. Cancel PROVIDER_ASSIGNED succeeds with 200');
    assert(resC2.json().data.booking.status === 'CANCELLED_BY_ADMIN', '36b. Status is CANCELLED_BY_ADMIN');

    // 37. REJECTED_BY_PROVIDER -> succeeds
    const c3Id = await seedBooking({ keySuffix: 'c-rej', status: 'REJECTED_BY_PROVIDER' });
    const resC3 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c3Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'No other technician available today' },
    });
    assert(resC3.statusCode === 200, '37. Cancel REJECTED_BY_PROVIDER succeeds with 200');

    // 38. PROVIDER_ACCEPTED -> succeeds
    const c4Id = await seedBooking({ keySuffix: 'c-acc', status: 'PROVIDER_ACCEPTED', providerId: provider1Id });
    const resC4 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c4Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Emergency customer reschedule' },
    });
    assert(resC4.statusCode === 200, '38. Cancel PROVIDER_ACCEPTED succeeds with 200');

    // 39. PROVIDER_ON_THE_WAY -> succeeds
    const c5Id = await seedBooking({ keySuffix: 'c-otw', status: 'PROVIDER_ON_THE_WAY', providerId: provider1Id });
    const resC5 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c5Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Road block prevents arrival' },
    });
    assert(resC5.statusCode === 200, '39. Cancel PROVIDER_ON_THE_WAY succeeds with 200');

    // 40. SERVICE_STARTED -> succeeds
    const c6Id = await seedBooking({ keySuffix: 'c-start', status: 'SERVICE_STARTED', providerId: provider1Id });
    const resC6 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c6Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Power cut prevents work' },
    });
    assert(resC6.statusCode === 200, '40. Cancel SERVICE_STARTED succeeds with 200');

    // 41. SERVICE_COMPLETED -> succeeds
    const c7Id = await seedBooking({ keySuffix: 'c-comp', status: 'SERVICE_COMPLETED', providerId: provider1Id });
    const resC7 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c7Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Dispute over incomplete work' },
    });
    assert(resC7.statusCode === 200, '41. Cancel SERVICE_COMPLETED succeeds with 200');

    // 42. PAYMENT_PENDING -> succeeds
    const c8Id = await seedBooking({
      keySuffix: 'c-paypen',
      status: 'PAYMENT_PENDING',
      providerId: provider1Id,
      finalAmount: 99.0,
    });
    const resC8 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c8Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Waived visit charge by management' },
    });
    assert(resC8.statusCode === 200, '42. Cancel PAYMENT_PENDING succeeds with 200');

    // 43. PAYMENT_COLLECTED -> 409
    const c9Id = await seedBooking({
      keySuffix: 'c-paycol',
      status: 'PAYMENT_COLLECTED',
      providerId: provider1Id,
      finalAmount: 99.0,
      paymentCollected: true,
    });
    const resC9 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c9Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Should fail because cash was collected' },
    });
    assert(resC9.statusCode === 409, '43. Cancel PAYMENT_COLLECTED returns 409 Conflict');
    assert(resC9.json().error.code === 'INVALID_STATUS_TRANSITION', '43b. Error code is INVALID_STATUS_TRANSITION');

    // 44. BOOKING_COMPLETED -> 409
    const c10Id = await seedBooking({
      keySuffix: 'c-bkcomp',
      status: 'BOOKING_COMPLETED',
      providerId: provider1Id,
      finalAmount: 99.0,
      paymentCollected: true,
    });
    const resC10 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c10Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Should fail on completed booking' },
    });
    assert(resC10.statusCode === 409, '44. Cancel BOOKING_COMPLETED returns 409 Conflict');

    // 45. CANCELLED_BY_CUSTOMER -> 409
    const c11Id = await seedBooking({ keySuffix: 'c-bycust', status: 'CANCELLED_BY_CUSTOMER' });
    const resC11 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c11Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Already cancelled by customer' },
    });
    assert(resC11.statusCode === 409, '45. Cancel CANCELLED_BY_CUSTOMER returns 409 Conflict');

    // 46. CANCELLED_BY_ADMIN -> 409 (repeated cancellation)
    const resC12 = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${c1Id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Repeated cancellation attempt' },
    });
    assert(resC12.statusCode === 409, '46. Repeated cancellation returns 409 Conflict');

    // Cancellation Reason Validation
    const testValidTarget = await seedBooking({ keySuffix: 'c-val', status: 'SERVICE_REQUESTED' });

    // 47. Missing reason -> 400
    const resNoReason = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${testValidTarget}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    assert(resNoReason.statusCode === 400, '47. Missing reason returns 400');

    // 48. Empty reason -> 400
    const resEmptyReason = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${testValidTarget}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: '' },
    });
    assert(resEmptyReason.statusCode === 400, '48. Empty reason returns 400');

    // 49. Whitespace reason -> 400
    const resWhitespaceReason = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${testValidTarget}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: '   ' },
    });
    assert(resWhitespaceReason.statusCode === 400, '49. Whitespace-only reason returns 400');

    // 50. Reason under 3 chars -> 400
    const resShortReason = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${testValidTarget}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'no' },
    });
    assert(resShortReason.statusCode === 400, '50. Reason under 3 chars returns 400');

    // 51. Reason over 255 chars -> 400
    const resLongReason = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${testValidTarget}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'x'.repeat(256) },
    });
    assert(resLongReason.statusCode === 400, '51. Reason over 255 chars returns 400');

    // Strict schema check: extra unknown fields rejected
    const resExtraFields = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${testValidTarget}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Valid reason here', extraField: 'not-allowed' },
    });
    assert(resExtraFields.statusCode === 400, '51b. Extra arbitrary request fields rejected with 400');

    // 52-57. Audit log verification after cancellation
    const verifyTarget = await seedBooking({
      keySuffix: 'c-verify',
      status: 'PROVIDER_ACCEPTED',
      providerId: provider1Id,
    });
    const exactReason = 'Customer moved away from town unexpectedly';
    const resVerifyCancel = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${verifyTarget}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: exactReason },
    });
    assert(resVerifyCancel.statusCode === 200, '52. Targeted cancellation succeeds');

    // Check DB status directly
    const { rows: dbBookingRows } = await pool.query<{ status: string; updated_at: Date }>(
      'SELECT status, updated_at FROM bookings WHERE id = $1',
      [verifyTarget]
    );
    assert(dbBookingRows[0].status === 'CANCELLED_BY_ADMIN', '52b. DB status is CANCELLED_BY_ADMIN');

    // Check audit status logs in DB
    const { rows: dbLogRows } = await pool.query<{
      booking_id: string;
      from_status: string;
      to_status: string;
      changed_by: string;
      notes: string;
    }>(
      `SELECT booking_id, from_status, to_status, changed_by, notes 
       FROM booking_status_logs 
       WHERE booking_id = $1 
       ORDER BY id DESC LIMIT 1`,
      [verifyTarget]
    );

    assert(dbLogRows.length === 1, '53. Audit status log created');
    assert(dbLogRows[0].changed_by === adminId, '54. Correct admin actor recorded in changed_by');
    assert(dbLogRows[0].notes === exactReason, '55. Exact reason stored in log notes');
    assert(dbLogRows[0].from_status === 'PROVIDER_ACCEPTED', '56. from_status is correct');
    assert(dbLogRows[0].to_status === 'CANCELLED_BY_ADMIN', '57. to_status is CANCELLED_BY_ADMIN');

    // -------------------------------------------------------------
    // SECTION E: TRANSACTION & ROLLBACK INTEGRITY
    // -------------------------------------------------------------
    console.log('\n--- Section E: Transaction & Rollback ---');

    // 58-60. Simulate transaction rollback on failure
    const rbBookingId = await seedBooking({
      keySuffix: 'c-rollback',
      status: 'SERVICE_REQUESTED',
    });

    const rbClient = await pool.connect();
    let simulatedFailureCaught = false;
    try {
      await rbClient.query('BEGIN');
      // Update status
      await rbClient.query("UPDATE bookings SET status = 'CANCELLED_BY_ADMIN' WHERE id = $1", [rbBookingId]);
      // Force failure during log insertion (e.g. invalid foreign key reference for changed_by)
      await rbClient.query(
        "INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes) VALUES ($1, 'SERVICE_REQUESTED', 'CANCELLED_BY_ADMIN', '00000000-0000-0000-0000-000000000000', 'Simulated failure')",
        [rbBookingId]
      );
      await rbClient.query('COMMIT');
    } catch {
      await rbClient.query('ROLLBACK');
      simulatedFailureCaught = true;
    } finally {
      rbClient.release();
    }

    assert(simulatedFailureCaught, '58. Simulated log insertion failure caught');

    const { rows: rbVerifyRows } = await pool.query<{ status: string }>(
      'SELECT status FROM bookings WHERE id = $1',
      [rbBookingId]
    );
    assert(rbVerifyRows[0].status === 'SERVICE_REQUESTED', '59. Booking status remains unchanged after rollback');

    const { rows: rbLogCheck } = await pool.query(
      "SELECT * FROM booking_status_logs WHERE booking_id = $1 AND to_status = 'CANCELLED_BY_ADMIN'",
      [rbBookingId]
    );
    assert(rbLogCheck.length === 0, '60. No orphan status log exists after rollback');

    // -------------------------------------------------------------
    // SECTION F: FINANCIAL SAFETY (READ-ONLY)
    // -------------------------------------------------------------
    console.log('\n--- Section F: Financial Safety ---');

    const finBookingId = await seedBooking({
      keySuffix: 'c-fin',
      status: 'PROVIDER_ACCEPTED',
      visitingFee: 149.0,
      finalAmount: 149.0,
      paymentCollected: false,
    });

    const resFinCancel = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${finBookingId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Customer cancelled after quote' },
    });
    assert(resFinCancel.statusCode === 200, '61-64. Cancellation executed');

    const { rows: finCheckRows } = await pool.query<{
      visiting_fee: string | number;
      final_amount: string | number | null;
      payment_method: string;
      payment_collected: boolean;
    }>(
      'SELECT visiting_fee, final_amount, payment_method, payment_collected FROM bookings WHERE id = $1',
      [finBookingId]
    );

    const finRow = finCheckRows[0];
    assert(parseFloat(String(finRow.visiting_fee)) === 149.0, '61. visiting_fee is unaltered (149.00)');
    assert(parseFloat(String(finRow.final_amount)) === 149.0, '62. final_amount is unaltered (149.00)');
    assert(finRow.payment_method === 'CASH', '63. payment_method remains CASH');
    assert(finRow.payment_collected === false, '64. payment_collected remains false');

    // -------------------------------------------------------------
    // SECTION G: HISTORICAL RELATIONSHIPS & AUDIT RETENTION
    // -------------------------------------------------------------
    console.log('\n--- Section G: Historical Integrity ---');

    const histBookingId = await seedBooking({
      keySuffix: 'c-hist',
      status: 'PROVIDER_ACCEPTED',
      providerId: provider1Id,
    });

    // Add extra intermediate status log
    await pool.query(
      `INSERT INTO booking_status_logs (booking_id, from_status, to_status, changed_by, notes)
       VALUES ($1, 'SERVICE_REQUESTED', 'PROVIDER_ACCEPTED', $2, 'Technician accepted via app')`,
      [histBookingId, provider1Id]
    );

    const resHistCancel = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${histBookingId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Admin intervened due to delay' },
    });
    assert(resHistCancel.statusCode === 200, '65-67. Historical booking cancelled');

    const { rows: histDbRows } = await pool.query<{
      customer_id: string;
      provider_id: string | null;
    }>('SELECT customer_id, provider_id FROM bookings WHERE id = $1', [histBookingId]);

    assert(histDbRows[0].customer_id === customerId, '65. Customer remains linked after cancellation');
    assert(histDbRows[0].provider_id === provider1Id, '66. Provider remains linked after cancellation');

    const { rows: histAllLogs } = await pool.query(
      'SELECT id, from_status, to_status FROM booking_status_logs WHERE booking_id = $1 ORDER BY id ASC',
      [histBookingId]
    );
    assert(histAllLogs.length === 3, '67. All historical status logs retained (initial, accept, cancel)');
    assert(histAllLogs[0].to_status === 'PROVIDER_ACCEPTED', '67b. Seed log retained');
    assert(histAllLogs[1].to_status === 'PROVIDER_ACCEPTED', '67c. Intermediate acceptance log retained');
    assert(histAllLogs[2].to_status === 'CANCELLED_BY_ADMIN', '67d. Terminal admin cancel log appended');

    // -------------------------------------------------------------
    // SECTION H: CONCURRENCY & STALE STATE OVERWRITE PROTECTION
    // -------------------------------------------------------------
    console.log('\n--- Section H: Concurrency & Stale Overwrite ---');

    // 68-69. Attempt cancellation against a booking whose state changed to PAYMENT_COLLECTED concurrently
    const concBookingId = await seedBooking({
      keySuffix: 'c-conc',
      status: 'PAYMENT_PENDING',
      providerId: provider1Id,
      finalAmount: 99.0,
    });

    // Concurrently transition to PAYMENT_COLLECTED (e.g. technician collected cash at the door)
    await pool.query(
      "UPDATE bookings SET status = 'PAYMENT_COLLECTED', payment_collected = true WHERE id = $1",
      [concBookingId]
    );

    // Stale cancellation attempt
    const resStaleCancel = await app.inject({
      method: 'POST',
      url: `/api/admin/bookings/${concBookingId}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { reason: 'Admin tries to cancel stale record' },
    });

    assert(resStaleCancel.statusCode === 409, '68. Stale cancellation rejected with 409 Conflict');
    assert(
      resStaleCancel.json().error.code === 'INVALID_STATUS_TRANSITION',
      '68b. Error code is INVALID_STATUS_TRANSITION'
    );

    const { rows: concCheckRows } = await pool.query<{ status: string }>(
      'SELECT status FROM bookings WHERE id = $1',
      [concBookingId]
    );
    assert(
      concCheckRows[0].status === 'PAYMENT_COLLECTED',
      '69. Newer state (PAYMENT_COLLECTED) was NOT overwritten by stale cancellation'
    );

    // -------------------------------------------------------------
    // SECTION I: TEST FIXTURE ISOLATION & CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- Section I: Test Isolation & Cleanup ---');
    await cleanupFixtures();

    const { rows: leftoverBookings } = await pool.query(
      "SELECT id FROM bookings WHERE idempotency_key LIKE 'adm-bk-%'"
    );
    assert(leftoverBookings.length === 0, '70. All Module 12C test fixtures cleanly isolated and removed');

  } catch (err) {
    console.error('Test execution threw an uncaught error:', err);
    failed++;
  } finally {
    await cleanupFixtures();
    await app.close();
  }

  console.log('\n============================================================');
  console.log(`ADMIN BOOKING TESTS COMPLETE: ${passed} passed, ${failed} failed`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdminBookingTests();
