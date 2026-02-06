// ==UserScript==
// @name         Passy
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Builds off of latte plugin by Merethin to load password reset links from some email providers
// @author       Kractero
// @match        https://*.nationstates.net/page=blank/passy
// @match        https://*.nationstates.net/*generated_by=Passy*
// @match        https://app.fastmail.com/mail/*
// @match        https://mail.google.com/*
// @match        https://outlook.live.com/*
// @match        https://mail.proton.me/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==
'use strict'
;(() => {
  let userAgent = GM_getValue('Passy_UA')
  let oldPassword = GM_getValue('Passy_old_password')
  let newPassword = GM_getValue('Passy_new_password')

  if (!userAgent) {
    userAgent = prompt('Provide a user agent (usually your main nation')
    if (!userAgent) {
      alert('User agent is required')
      return
    }
    GM_setValue('Passy_UA', userAgent)
  }

  if (!oldPassword) {
    oldPassword = prompt('Provide your old password')
    if (!oldPassword) {
      alert('The old password is required')
      return
    }
    GM_setValue('Passy_old_password', oldPassword)
  }

  if (!newPassword) {
    newPassword = prompt('Provide your intended new password')
    if (!newPassword) {
      alert('A new password is required')
      return
    }
    GM_setValue('Passy_new_password', newPassword)
  }

  if (window.location.href.includes('generated_by=Passy')) {
    function handler() {
      const url = new URL(window.location.href)
      const separator = url.searchParams.toString() ? '&' : '?'

      const regex = /(?:container=([^/]+)|nation=([^/]+))/
      const match = url.pathname.match(regex)

      const nation = match ? match[1] || match[2] : null

      let switchNation = false

      if (document.querySelector('.cf_inspection_box')) {
        return
      }

      if (document.querySelector('#loggedout')) {
        switchNation = true
      }

      if (document.querySelector('#loggedin')) {
        const loggedNation = document.body.getAttribute('data-nname')
        if (loggedNation !== nation.replaceAll(' ', '_').toLowerCase()) {
          switchNation = true
        }
      }

      if (!switchNation) return

      if (switchNation === true) {
        if (document.getElementById('loginbox')) {
          document.querySelector('#loginbox').classList.add('activeloginbox')
          document.querySelector('#loginbox > form input[name=nation]').value = nation

          document.querySelector('#loginbox > form input[name=password]').value = oldPassword
          document.querySelector('#loginbox > form input[name=autologin]').checked = true

          const loginbox = document.getElementById('loginbox')

          document.querySelectorAll('form input[type="submit"], form button').forEach(el => {
            if (!loginbox.contains(el)) {
              el.disabled = true
              el.classList.add('disabledForSimultaneity')
            }
          })

          document.addEventListener(
            'keyup',
            function onKeyUp(event) {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.stopImmediatePropagation()
                // set the form action to tell the form to send the login data to the relevant page, this has the benefit of landing back on the right page
                document.querySelector('#loginbox > form').action =
                  `${url}${separator}script=Passy__by_Kractero__usedBy_${userAgent}&userclick=${Date.now()}`
                localStorage.setItem('currentNation', nation)
                document.querySelector('#loginbox > form button[name=submit]').click()
                document.removeEventListener('keyup', onKeyUp)
              }
            },
            { capture: true, once: true }
          )
        }

        return
      }
    }
    handler()
  }

  function addApplication(nation, appid = '') {
    const passy = JSON.parse(GM_getValue('passy') || '{}')
    if (passy.hasOwnProperty(nation)) return
    passy[nation] = appid
    GM_setValue('passy', JSON.stringify(passy))
  }

  const NS_LINK_REGEX = /^https:\/\/www\.nationstates\.net\/asnation=([a-zA-Z0-9_\-]+)/

  function observeEmails(emailSelector) {
    const observer = new MutationObserver(() => {
      const email = document.querySelector(emailSelector)
      if (!email) return

      const links = email.querySelectorAll('a')
      for (const link of links) {
        const match = NS_LINK_REGEX.exec(link.href)
        if (!match) continue

        const nation = match[1]
        addApplication(nation, '')
        break
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })
  }

  const url = new URL(window.location.href)
  if (url.hostname === 'www.nationstates.net' && url.pathname === '/page=blank/passy') {
    const generateBtn = document.createElement('button')
    generateBtn.textContent = 'Generate Sheet'

    const clearBtn = document.createElement('button')
    clearBtn.textContent = 'Delete Sheet'

    const clearAllBtn = document.createElement('button')
    clearAllBtn.textContent = 'Clear All Data'

    document.body.append(generateBtn, clearBtn, clearAllBtn)

    generateBtn.addEventListener('click', () => {
      const passy = JSON.parse(GM_getValue('passy') || '{}')
      const content = Object.entries(passy).map(([nation, appid]) => ({
        url: `https://www.nationstates.net/nation=${nation}/template-overall=none?generated_by=Passy__author_main_nation_Kractero__usedBy_${userAgent}`,
        tableText: nation,
      }))

      const sheetHTML = generateHTMLSheet(content, 'Passy')

      const blob = new Blob([sheetHTML], { type: 'text/html' })
      const fileName = `Passy.html`
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      link.click()

      URL.revokeObjectURL(url)
    })

    clearBtn.addEventListener('click', () => {
      if (!confirm('This will wipe out your current sheet')) return
      GM_setValue('passy', '{}')
    })

    clearAllBtn.addEventListener('click', () => {
      if (!confirm('Clear all passy data')) return
      GM_setValue('passy', '{}')
      GM_setValue('Passy_UA', '')
      GM_setValue('Passy_old_password', '')
      GM_setValue('Passy_new_password', '')
      location.reload()
    })
  } else {
    const url = new URL(window.location.href)

    // OUTLOOK
    if (url.hostname === 'outlook.live.com' && url.pathname.startsWith('/mail/')) {
      observeEmails('.wide-content-host')
      // PROTON
    } else if (url.hostname === 'mail.proton.me') {
      observeEmails('.message-content')
      // FASTMAIL
    } else if (url.hostname === 'app.fastmail.com' && url.pathname.startsWith('/mail/')) {
      observeEmails('.v-Message')
      // GMAIL
    } else if (url.hostname === 'mail.google.com' && url.pathname.startsWith('/mail/')) {
      observeEmails('.ads')
      // window.addEventListener('hashchange', () => {
      //   const links = document.querySelectorAll('a')
      //   for (const link of links) {
      //     const result = NS_LINK_REGEX.exec(link.href)
      //     if (!result) continue
      //     addApplication(result[1], '')
      //     break
      //   }
      // })
      // NOT
      // NOT
    } else {
      console.log('Email service not explicitly handled.')
    }
  }

  function generateHTMLSheet(content) {
    const tableRows = content
      .map(
        (obj, i) => `
                <tr>
                    <td><p>${i + 1}</p></td>
                    <td><p><a target="_blank" href="${obj.url}">${obj.tableText}</a></p></td>
                </tr>`
      )
      .join('')

    return `
        <html>
        <head>
        <style>
          td.createcol p {
            padding-left: 10em;
          }

          a {
            text-decoration: none;
            color: black;
          }

          a:visited {
            color: grey;
          }

          table {
            border-collapse: collapse;
            display: table-cell;
            max-width: 100%;
            border: 1px solid darkorange;
          }

          tr, td {
            border-bottom: 1px solid darkorange;
          }

          td p {
            padding: 0.5em;
          }

          tr:hover {
            background-color: lightgrey;
          }

          #openNextLink, #clearStorage {
            margin-bottom: 2rem;
            margin-right: 2rem;
          }

          @media (prefers-color-scheme: dark) {
            html {
              background-color: black;
            }
            h2 {
              color: rgb(145, 23, 76);
            }
            a, p, span {
              color: rgb(232, 211, 162);
            }
            a:visited {
              color: rgb(145, 23, 76);
            }
            table, tr, td {
              border: 1px solid rgb(51, 0, 111);
            }
          }
        </style>
        </head>
        <body>
            <h2>Password Reset Sheet</h2>
            <p>Progress: <span id="progress">0</span> / ${content.length}</p>
            <button id="openNextLink" disabled>Open Next Link</button>
            <button id="clearProgress">Clear Progress</button>
            <table>
                ${tableRows}
            </table>
            <script>
                const links = Array.from(document.querySelectorAll('table tr td a'));
                const openBtn = document.getElementById('openNextLink');
                const clearBtn = document.getElementById('clearProgress');
                const progress = document.getElementById('progress');

                let counter = 0;

                const updateProgress = () => { progress.textContent = counter; }
                const updateButton = () => {
                    openBtn.disabled = links.length === 0;
                    openBtn.style.cursor = links.length === 0 ? 'not-allowed' : 'pointer';
                }

                updateProgress();
                updateButton();

                const storedIndex = parseInt(localStorage.getItem('sheetProgress') || '0', 10);
                if (!isNaN(storedIndex) && storedIndex > 0) {
                    for (let i = 0; i < storedIndex; i++) {
                        const row = document.querySelector('table tr');
                        if (row) row.remove();
                    }
                    links.splice(0, storedIndex);
                    counter = storedIndex;
                    updateProgress();
                }

                openBtn.disabled = links.length === 0;

                openBtn.addEventListener('click', () => {
                    if (links.length === 0) return;
                    const link = links.shift();
                    window.open(link.href, '_blank');
                    const row = document.querySelector('a[href="' + link.href + '"]').closest('tr');
                    if (row) row.remove();
                    counter++;
                    localStorage.setItem('sheetProgress', counter);
                    updateProgress();
                    updateButton();
                });

                clearBtn.addEventListener('click', () => {
                    localStorage.removeItem('sheetProgress');
                    location.reload();
                });
            </script>
        </body>
        </html>`
  }
})()
