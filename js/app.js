// ── State ──
let currentUser = null
let currentProfile = null
let activeDelay = null

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await db.auth.getSession()
  if (session) await bootApp(session.user)
  else showPage('login')

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) await bootApp(session.user)
    if (event === 'SIGNED_OUT') showPage('login')
  })

  bindLoginPage()
  bindFirstLoginFlow()
  bindNav()
  bindLetters()
  bindTaika()
  bindAgreements()
})

// ── Boot ──
async function bootApp(user) {
  currentUser = user
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  currentProfile = profile

  if (!profile.first_login_complete) {
    document.getElementById('notification-email').value = profile.notification_email || user.email
    showPage('first-login')
    return
  }

  document.getElementById('nav-title').textContent = profile.display_name === 'Juvae'
    ? "Juvae's Portal"
    : "Cierewyn's Space"

  if (profile.username === 'cierewyn') {
    document.getElementById('delay-selector').classList.remove('hidden')
  }

  if (profile.username === 'juvae') {
    document.getElementById('taika-admin').classList.remove('hidden')
  } else {
    document.getElementById('taika-request').classList.remove('hidden')
  }

  showPage('app')
  await loadLetters()
  await checkActiveDelay()
  await loadVisitTimes()
  await loadAgreements()
}

// ── Pages ──
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.getElementById(`page-${name}`).classList.add('active')
}

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
  document.getElementById(`section-${name}`).classList.add('active')
  document.querySelector(`[data-section="${name}"]`).classList.add('active')
}

// ── Login ──
function bindLoginPage() {
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim()
    const password = document.getElementById('login-password').value
    const errEl = document.getElementById('login-error')

    errEl.classList.add('hidden')
    const { error } = await db.auth.signInWithPassword({ email, password })
    if (error) {
      errEl.textContent = 'Invalid email or password.'
      errEl.classList.remove('hidden')
    }
  })

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await db.auth.signOut()
  })
}

// ── First Login Flow ──
function bindFirstLoginFlow() {
  document.getElementById('set-password-btn').addEventListener('click', async () => {
    const newPass = document.getElementById('new-password').value
    const confirmPass = document.getElementById('confirm-password').value
    const errEl = document.getElementById('password-error')

    errEl.classList.add('hidden')

    if (newPass === 'password') {
      errEl.textContent = 'Please choose a different password.'
      errEl.classList.remove('hidden')
      return
    }
    if (newPass !== confirmPass) {
      errEl.textContent = 'Passwords do not match.'
      errEl.classList.remove('hidden')
      return
    }
    if (newPass.length < 8) {
      errEl.textContent = 'Password must be at least 8 characters.'
      errEl.classList.remove('hidden')
      return
    }

    const { error } = await db.auth.updateUser({ password: newPass })
    if (error) {
      errEl.textContent = error.message
      errEl.classList.remove('hidden')
      return
    }

    document.getElementById('first-login-step-1').classList.add('hidden')
    document.getElementById('first-login-step-2').classList.remove('hidden')
  })

  document.getElementById('save-email-btn').addEventListener('click', async () => {
    const email = document.getElementById('notification-email').value.trim()
    const errEl = document.getElementById('email-error')

    errEl.classList.add('hidden')

    if (!email) {
      errEl.textContent = 'Please enter an email address.'
      errEl.classList.remove('hidden')
      return
    }

    const { error } = await db
      .from('profiles')
      .update({ notification_email: email })
      .eq('id', currentUser.id)

    if (error) {
      errEl.textContent = error.message
      errEl.classList.remove('hidden')
      return
    }

    document.getElementById('first-login-step-2').classList.add('hidden')
    document.getElementById('first-login-step-3').classList.remove('hidden')
  })

  document.getElementById('test-email-btn').addEventListener('click', async () => {
    await sendNotificationEmail(
      currentProfile.notification_email,
      'Letters — Test Notification',
      `Hi ${currentProfile.display_name}, your email notifications are working correctly.`
    )
    alert('Test email sent. Please check your inbox.')
  })

  document.getElementById('finish-setup-btn').addEventListener('click', async () => {
    await db
      .from('profiles')
      .update({ first_login_complete: true })
      .eq('id', currentUser.id)

    currentProfile.first_login_complete = true
    await bootApp(currentUser)
  })
}

// ── Nav ──
function bindNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showSection(btn.dataset.section)
    })
  })
}

// ── Letters ──
async function loadLetters() {
  const { data: messages } = await db
    .from('messages')
    .select('*, profiles(display_name, username)')
    .eq('is_draft', false)
    .order('sent_at', { ascending: true })

  const { data: drafts } = await db
    .from('messages')
    .select('*, profiles(display_name, username)')
    .eq('is_draft', true)
    .eq('sender_id', currentUser.id)
    .order('created_at', { ascending: true })

  const timeline = document.getElementById('letters-timeline')
  timeline.innerHTML = ''

  const allItems = [
    ...(messages || []),
    ...(drafts || [])
  ].sort((a, b) => new Date(a.sent_at || a.created_at) - new Date(b.sent_at || b.created_at))

  if (allItems.length === 0) {
    timeline.innerHTML = '<p style="color:var(--text-secondary);font-family:var(--font-ui);text-align:center;padding:40px 0;">No letters yet.</p>'
    return
  }

  allItems.forEach(msg => {
    const el = document.createElement('div')
    el.className = `letter-entry${msg.is_draft ? ' letter-draft' : ''}`

    const date = new Date(msg.sent_at || msg.created_at)
    const dateStr = date.toLocaleDateString('en-ZA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })
    const timeStr = date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })

    el.innerHTML = `
      <div class="letter-meta">
        <span class="letter-sender">${msg.profiles?.display_name || 'Unknown'}${msg.is_draft ? ' <em style="font-weight:normal;color:var(--text-secondary)">(draft)</em>' : ''}</span>
        <span>${dateStr} · ${timeStr}</span>
      </div>
      ${msg.emotional_tone ? `<span class="letter-tone">${msg.emotional_tone}</span><br><br>` : ''}
      <div class="letter-content">${escapeHtml(msg.content)}</div>
      ${msg.is_draft ? `<div style="margin-top:16px;display:flex;gap:8px;">
        <button class="btn-secondary" onclick="window.editDraft('${msg.id}')">Edit</button>
        <button class="btn-primary" onclick="window.sendDraft('${msg.id}')">Send</button>
      </div>` : ''}
    `
    timeline.appendChild(el)
  })
}

function bindLetters() {
  document.getElementById('save-draft-btn').addEventListener('click', async () => {
    const content = document.getElementById('compose-text').value.trim()
    if (!content) return

    const tone = document.getElementById('emotional-tone').value

    await db.from('messages').insert({
      sender_id: currentUser.id,
      content,
      emotional_tone: tone || null,
      is_draft: true
    })

    document.getElementById('compose-text').value = ''
    document.getElementById('emotional-tone').value = ''
    await loadLetters()
  })

  document.getElementById('send-letter-btn').addEventListener('click', async () => {
    const content = document.getElementById('compose-text').value.trim()
    if (!content) return

    const tone = document.getElementById('emotional-tone').value
    const now = new Date().toISOString()

    const { data: msg, error } = await db.from('messages').insert({
      sender_id: currentUser.id,
      content,
      emotional_tone: tone || null,
      is_draft: false,
      sent_at: now
    }).select().single()

    if (error) { alert('Error sending letter.'); return }

    if (currentProfile.username === 'cierewyn') {
      const delayType = document.getElementById('delay-choice').value
      const unlockAt = calculateUnlockDate(delayType)

      await db.from('response_delays').insert({
        triggered_by_message_id: msg.id,
        delay_type: delayType,
        unlock_at: unlockAt
      })

      await sendNotificationEmail(
        await getOtherUserEmail(),
        'Letters — A new letter has arrived',
        `${currentProfile.display_name} has sent you a letter. You may reply after ${formatDate(unlockAt)}.`
      )
    } else {
      await sendNotificationEmail(
        await getOtherUserEmail(),
        'Letters — A new letter has arrived',
        `${currentProfile.display_name} has sent you a letter.`
      )
    }

    document.getElementById('compose-text').value = ''
    document.getElementById('emotional-tone').value = ''
    await loadLetters()
    await checkActiveDelay()
  })
}

window.editDraft = async function(id) {
  const { data: draft } = await db.from('messages').select('*').eq('id', id).single()
  document.getElementById('compose-text').value = draft.content
  document.getElementById('emotional-tone').value = draft.emotional_tone || ''
  await db.from('messages').delete().eq('id', id)
  await loadLetters()
}

window.sendDraft = async function(id) {
  const now = new Date().toISOString()
  await db.from('messages').update({
    is_draft: false,
    sent_at: now
  }).eq('id', id)

  await sendNotificationEmail(
    await getOtherUserEmail(),
    'Letters — A new letter has arrived',
    `${currentProfile.display_name} has sent you a letter.`
  )

  await loadLetters()
}

// ── Delay ──
async function checkActiveDelay() {
  const { data: delays } = await db
    .from('response_delays')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  const silenceEl = document.getElementById('silence-indicator')
  const silenceText = document.getElementById('silence-text')
  const composeArea = document.getElementById('compose-area')

  if (!delays || delays.length === 0) {
    silenceEl.classList.add('hidden')
    composeArea.classList.remove('hidden')
    return
  }

  const latest = delays[0]
  const unlockAt = new Date(latest.unlock_at)
  const now = new Date()

  if (now < unlockAt && currentProfile.username === 'juvae') {
    activeDelay = latest
    silenceEl.classList.remove('hidden')
    silenceText.textContent = `No reply expected until ${formatDate(unlockAt)}`
    composeArea.classList.add('hidden')
    startCountdown(unlockAt)
  } else {
    silenceEl.classList.add('hidden')
    activeDelay = null
    composeArea.classList.remove('hidden')
  }
}

function startCountdown(unlockAt) {
  const silenceText = document.getElementById('silence-text')
  const interval = setInterval(() => {
    const now = new Date()
    const diff = unlockAt - now
    if (diff <= 0) {
      clearInterval(interval)
      checkActiveDelay()
      return
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    silenceText.textContent = `No reply expected until ${formatDate(unlockAt)} — ${days}d ${hours}h ${mins}m remaining`
  }, 60000)
}

function calculateUnlockDate(delayType) {
  const now = new Date()
  if (delayType === 'day') now.setDate(now.getDate() + 1)
  if (delayType === 'week') now.setDate(now.getDate() + 7)
  if (delayType === 'month') now.setMonth(now.getMonth() + 1)
  return now.toISOString()
}

// ── Taika Time ──
async function loadVisitTimes() {
  const { data: visits } = await db
    .from('visit_times')
    .select('*')
    .order('date', { ascending: true })

  const list = document.getElementById('visit-times-list')
  list.innerHTML = ''

  if (!visits || visits.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);font-family:var(--font-ui);">No visit times yet.</p>'
    return
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const upcoming = visits.filter(v => v.date >= todayStr)
  const past = visits.filter(v => v.date < todayStr)

  if (upcoming.length > 0) {
    const h = document.createElement('h3')
    h.textContent = 'Upcoming'
    h.style.cssText = 'font-family:var(--font-ui);color:var(--text-secondary);margin-bottom:8px;'
    list.appendChild(h)
    upcoming.forEach(v => list.appendChild(renderVisitEntry(v)))
  }

  if (past.length > 0) {
    const h = document.createElement('h3')
    h.textContent = 'Past'
    h.style.cssText = 'font-family:var(--font-ui);color:var(--text-secondary);margin-top:24px;margin-bottom:8px;'
    list.appendChild(h)
    past.forEach(v => list.appendChild(renderVisitEntry(v)))
  }
}

function renderVisitEntry(v) {
  const el = document.createElement('div')
  el.className = 'visit-entry'

  const [year, month, day] = v.date.split('-')
  const dateObj = new Date(year, month - 1, day)
  const dateStr = dateObj.toLocaleDateString('en-ZA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  })

  let actions = ''

  if (currentProfile.username === 'cierewyn' && v.status === 'available') {
    actions = `<button class="btn-primary" onclick="window.confirmVisit('${v.id}')">Confirm</button>`
  }

  if (currentProfile.username === 'juvae') {
    if (v.status === 'requested') {
      actions = `
        <button class="btn-primary" onclick="window.approveVisit('${v.id}')">Approve</button>
        <button class="btn-secondary" onclick="window.declineVisit('${v.id}')">Decline</button>
      `
    }
    if (v.status === 'available') {
      actions = `<button class="btn-ghost" onclick="window.deleteVisit('${v.id}')">Delete</button>`
    }
  }

  el.innerHTML = `
    <div class="visit-info">
      <div class="visit-date-time">${dateStr}</div>
      <div style="font-family:var(--font-ui);font-size:0.9rem;color:var(--text-secondary)">
        ${v.start_time} — ${v.end_time}
      </div>
      ${v.decline_reason ? `<div class="decline-reason">Declined: ${escapeHtml(v.decline_reason)}</div>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
      <span class="visit-status status-${v.status}">${v.status}</span>
      <div class="visit-actions">${actions}</div>
    </div>
  `
  return el
}

function bindTaika() {
  document.getElementById('create-visit-btn')?.addEventListener('click', async () => {
    const date = document.getElementById('visit-date').value
    const start = document.getElementById('visit-start').value
    const end = document.getElementById('visit-end').value

    if (!date || !start || !end) { alert('Please fill in all fields.'); return }

    const { error } = await db.from('visit_times').insert({
      created_by: currentUser.id,
      date,
      start_time: start,
      end_time: end,
      status: 'available'
    })

    if (error) { alert('Error creating visit time: ' + error.message); return }

    await sendNotificationEmail(
      await getOtherUserEmail(),
      'Letters — New Visit Time available',
      `${currentProfile.display_name} has created a Visit Time on ${date} from ${start} to ${end}.\n\nVisit Letters to confirm it.`
    )

    document.getElementById('visit-date').value = ''
    document.getElementById('visit-start').value = ''
    document.getElementById('visit-end').value = ''
    await loadVisitTimes()
  })

  document.getElementById('submit-request-btn')?.addEventListener('click', async () => {
    const date = document.getElementById('request-date').value
    const start = document.getElementById('request-start').value
    const end = document.getElementById('request-end').value

    if (!date || !start || !end) { alert('Please fill in all fields.'); return }

    const { error } = await db.from('visit_times').insert({
      created_by: currentUser.id,
      date,
      start_time: start,
      end_time: end,
      status: 'requested',
      requested_by: currentUser.id
    })

    if (error) { alert('Error submitting request: ' + error.message); return }

    await sendNotificationEmail(
      await getOtherUserEmail(),
      'Letters — New Visit Time requested',
      `${currentProfile.display_name} has requested a Visit Time on ${date} from ${start} to ${end}.\n\nVisit Letters to approve or decline.`
    )

    document.getElementById('request-date').value = ''
    document.getElementById('request-start').value = ''
    document.getElementById('request-end').value = ''
    await loadVisitTimes()
  })
}

window.confirmVisit = async function(id) {
  const { data: visit } = await db.from('visit_times').select('*').eq('id', id).single()

  await db.from('visit_times').update({
    status: 'confirmed',
    requested_by: currentUser.id,
    updated_at: new Date().toISOString()
  }).eq('id', id)

  await sendNotificationEmail(
    await getOtherUserEmail(),
    'Letters — Visit Time confirmed',
    `${currentProfile.display_name} has confirmed the Visit Time on ${visit.date} from ${visit.start_time} to ${visit.end_time}.`
  )

  await loadVisitTimes()
}

window.approveVisit = async function(id) {
  const { data: visit } = await db.from('visit_times').select('*').eq('id', id).single()

  await db.from('visit_times').update({
    status: 'confirmed',
    updated_at: new Date().toISOString()
  }).eq('id', id)

  await sendNotificationEmail(
    await getOtherUserEmail(),
    'Letters — Visit Time approved',
    `${currentProfile.display_name} has approved your Visit Time request for ${visit.date} from ${visit.start_time} to ${visit.end_time}.`
  )

  await loadVisitTimes()
}

window.declineVisit = async function(id) {
  const reason = prompt('Please provide a reason for declining:')
  if (!reason) return

  const { data: visit } = await db.from('visit_times').select('*').eq('id', id).single()

  await db.from('visit_times').update({
    status: 'declined',
    decline_reason: reason,
    updated_at: new Date().toISOString()
  }).eq('id', id)

  await sendNotificationEmail(
    await getOtherUserEmail(),
    'Letters — Visit Time declined',
    `${currentProfile.display_name} has declined the Visit Time request for ${visit.date}.\n\nReason: ${reason}`
  )

  await loadVisitTimes()
}

window.deleteVisit = async function(id) {
  const { error } = await db.from('visit_times').delete().eq('id', id)
  if (error) { alert('Error deleting: ' + error.message); return }
  await loadVisitTimes()
}
}

// ── Agreements ──
async function loadAgreements() {
  const { data } = await db.from('agreements').select('*').single()
  if (data) document.getElementById('agreements-text').value = data.content
}

function bindAgreements() {
  document.getElementById('save-agreements-btn').addEventListener('click', async () => {
    const content = document.getElementById('agreements-text').value
    const savedEl = document.getElementById('agreements-saved')

    await db.from('agreements').update({
      content,
      last_edited_by: currentUser.id,
      updated_at: new Date().toISOString()
    }).neq('id', '00000000-0000-0000-0000-000000000000')

    savedEl.classList.remove('hidden')
    setTimeout(() => savedEl.classList.add('hidden'), 3000)
  })
}

// ── Email Notifications ──
async function sendNotificationEmail(to, subject, body) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ to, subject, body })
    })
  } catch (e) {
    console.warn('Email notification failed:', e)
  }
}

async function getOtherUserEmail() {
  const otherUsername = currentProfile.username === 'juvae' ? 'cierewyn' : 'juvae'
  const { data } = await db
    .from('profiles')
    .select('notification_email')
    .eq('username', otherUsername)
    .single()
  return data?.notification_email
}

// ── Helpers ──
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
