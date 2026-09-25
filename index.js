/**
 * AFK Bot đa tài khoản cho Minecraft (Java Edition, offline/cracked mode)
 *
 * CÁCH DÙNG:
 *   npm install
 *   node index.js
 *
 * Đây là bot CHỐNG AFK thuần tuý (nhảy/xoay người để không bị kick do đứng yên).
 * KHÔNG tự động farm rương, KHÔNG tự click menu, KHÔNG bypass giới hạn của server.
 */

const readline = require('readline')
const { loadConfig, saveConfig } = require('./lib/config')
const { createAfkBot } = require('./lib/afkBot')

let config = loadConfig()
let tab = 'home' // 'home' | 'select'
let runningBots = new Map() // username -> { command, stop }
let isRunning = false

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

function log(...args) { console.log(...args) }

function printBanner() {
  console.log('='.repeat(50))
  console.log(' AFK BOT MANAGER - Minecraft Java Edition')
  console.log('='.repeat(50))
}

function printHomeTab() {
  printBanner()
  console.log(`\nHost hiện tại: ${config.host}:${config.port}`)
  console.log(`Webhook: ${config.webhookUrl ? 'Đã đặt' : 'Trống'}`)
  console.log(`\nDanh sách tài khoản đã thêm (${config.accounts.length}):`)
  if (config.accounts.length === 0) console.log('  (chưa có tài khoản nào)')
  config.accounts.forEach((a, i) => console.log(`  [${i + 1}] ${a.username}`))
  console.log(`\n- 'Add <username>'       thêm tài khoản`)
  console.log(`- 'Del <username/index>' xoá tài khoản`)
  console.log(`- 'Webhook <url>'        đặt Discord webhook (báo online/offline)`)
  console.log(`- 'Select'               sang tab chọn & chạy bot`)
  console.log(`- 'Setting'              xem/sửa host, port, version...`)
  console.log(`- 'Help'                 xem lại danh sách lệnh`)
  console.log(`- 'Exit'                 thoát chương trình`)
}

function printSelectTab() {
  printBanner()
  console.log(`\nDanh sách tài khoản (${config.accounts.length}):`)
  config.accounts.forEach((a, i) => {
    const mark = config.selected.includes(a.username) ? 'x' : ' '
    console.log(`  [${mark}] [${i + 1}] ${a.username}`)
  })
  console.log(`\nĐã chọn (${config.selected.length}): ${config.selected.join(', ') || '(chưa chọn)'}`)
  console.log(`\n- 'Acc <username/index>' chọn/bỏ chọn tài khoản để treo`)
  console.log(`- 'Run'                  chạy AFK bot cho các tài khoản đã chọn`)
  console.log(`- 'Stop'                 dừng toàn bộ bot đang chạy`)
  console.log(`- 'Home'                 quay lại tab chính`)
  console.log(`- 'Help'                 xem lại danh sách lệnh`)
  console.log(`- 'Exit'                 thoát chương trình`)
}

function printPrompt() {
  console.log('')
  rl.setPrompt(isRunning ? '(đang chạy)> ' : '> ')
  rl.prompt()
}

function render() {
  console.clear()
  if (tab === 'home') printHomeTab()
  else printSelectTab()
  printPrompt()
}

function findAccountRef(usernameOrIndex) {
  const idx = parseInt(usernameOrIndex, 10)
  if (!isNaN(idx) && idx >= 1 && idx <= config.accounts.length) {
    return config.accounts[idx - 1]
  }
  return config.accounts.find((a) => a.username.toLowerCase() === usernameOrIndex.toLowerCase())
}

function cmdAdd(username) {
  if (!username) { log('Cú pháp: Add <username>'); return }
  if (config.accounts.some((a) => a.username.toLowerCase() === username.toLowerCase())) {
    log(`Tài khoản "${username}" đã tồn tại.`)
    return
  }
  config.accounts.push({ username })
  saveConfig(config)
  log(`Đã thêm tài khoản "${username}".`)
}

function cmdDel(ref) {
  const acc = findAccountRef(ref)
  if (!acc) { log(`Không tìm thấy tài khoản "${ref}".`); return }
  config.accounts = config.accounts.filter((a) => a.username !== acc.username)
  config.selected = config.selected.filter((u) => u !== acc.username)
  saveConfig(config)
  log(`Đã xoá tài khoản "${acc.username}".`)
}

function cmdAcc(ref) {
  const acc = findAccountRef(ref)
  if (!acc) { log(`Không tìm thấy tài khoản "${ref}".`); return }
  if (config.selected.includes(acc.username)) {
    config.selected = config.selected.filter((u) => u !== acc.username)
    log(`Đã bỏ chọn "${acc.username}".`)
  } else {
    config.selected.push(acc.username)
    log(`Đã chọn "${acc.username}".`)
  }
  saveConfig(config)
}

function cmdWebhook(url) {
  config.webhookUrl = url || ''
  saveConfig(config)
  log(url ? 'Đã lưu webhook.' : 'Đã xoá webhook.')
}

function cmdSetting(args) {
  // Setting host <giá trị> | Setting port <giá trị> | Setting show
  const [key, ...rest] = args
  const value = rest.join(' ')
  if (!key || key === 'show') {
    log(`host=${config.host} port=${config.port} version=${config.version} antiAfkIntervalMs=${config.antiAfkIntervalMs} reconnectDelayMs=${config.reconnectDelayMs}`)
    log('Sửa bằng: Setting host <giá trị> | Setting port <giá trị> | Setting version <giá trị|auto>')
    return
  }
  switch (key.toLowerCase()) {
    case 'host': config.host = value; break
    case 'port': config.port = parseInt(value, 10) || config.port; break
    case 'version': config.version = value.toLowerCase() === 'auto' ? false : value; break
    default: log(`Không rõ setting "${key}".`); return
  }
  saveConfig(config)
  log('Đã lưu cấu hình.')
}

function cmdRun() {
  if (config.selected.length === 0) {
    log('Chưa chọn tài khoản nào. Dùng "Acc <username/index>" trước.')
    return
  }
  if (isRunning) {
    log('Bot đang chạy rồi. Dùng "Stop" để dừng trước khi chạy lại.')
    return
  }
  isRunning = true
  console.clear()
  printBanner()
  console.log(`\nĐang khởi chạy ${config.selected.length} bot trên ${config.host}:${config.port}...`)
  console.log(`Gõ lệnh trực tiếp bên dưới (áp dụng cho tất cả bot đang chạy): status, say <tin>, pause, resume, jump`)
  console.log(`Gõ "stop" để dừng toàn bộ và quay lại menu.\n`)

  config.selected.forEach((username) => {
    const b = createAfkBot({
      host: config.host,
      port: config.port,
      version: config.version,
      username,
      owners: [username], // mặc định chỉ chính tài khoản đó mới tự ra lệnh qua chat game
      chatPrefix: config.chatPrefix,
      antiAfkIntervalMs: config.antiAfkIntervalMs,
      reconnectDelayMs: config.reconnectDelayMs,
      webhookUrl: config.webhookUrl,
      onLog: (msg) => console.log(msg),
    })
    runningBots.set(username, b)
  })
  printPrompt()
}

function cmdStopAll() {
  if (!isRunning) { log('Không có bot nào đang chạy.'); return }
  runningBots.forEach((b) => b.stop())
  runningBots.clear()
  isRunning = false
  log('Đã dừng toàn bộ bot.')
}

function handleLine(line) {
  const trimmed = line.trim()
  if (!trimmed) { printPrompt(); return }
  const args = trimmed.split(/\s+/)
  const cmd = args.shift().toLowerCase()
  const rest = args.join(' ')

  // Khi đang chạy: lệnh gõ vào sẽ broadcast tới tất cả bot đang chạy
  if (isRunning && ['status', 'say', 'pause', 'resume', 'jump', 'reconnect'].includes(cmd)) {
    runningBots.forEach((b) => b.command(cmd, args))
    printPrompt()
    return
  }
  if (isRunning && (cmd === 'stop')) {
    cmdStopAll()
    render()
    return
  }

  switch (cmd) {
    case 'help':
      // lệnh help sẽ được vẽ lại kèm theo tab hiện tại
      render()
      return
    case 'exit': case 'quit':
      cmdStopAll()
      rl.close()
      process.exit(0)
      return
    case 'home':
      tab = 'home'
      break
    case 'select':
      tab = 'select'
      break
    case 'add':
      if (tab === 'home') cmdAdd(rest)
      break
    case 'del':
      if (tab === 'home') cmdDel(rest)
      break
    case 'webhook':
      if (tab === 'home') cmdWebhook(rest)
      break
    case 'setting':
      if (tab === 'home') cmdSetting(args)
      break
    case 'acc':
      if (tab === 'select') cmdAcc(rest)
      break
    case 'run':
      if (tab === 'select') cmdRun()
      return // cmdRun tự vẽ màn hình riêng
    case 'stop':
      cmdStopAll()
      break
    default:
      log(`Không hiểu lệnh "${cmd}". Gõ "Help" để xem lại.`)
  }
  render()
}

rl.on('line', handleLine)
render()
