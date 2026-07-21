<script>
import { checkApiOnline } from './utils/userService.js'
import { hasPrivacyAgreed } from './utils/privacy.js'
import { getToken } from './utils/api.js'
import { safeReLaunch } from './utils/nav.js'

export default {
  onLaunch() {
    this.routeByPrivacy()
  },
  onShow() {
    this.routeByPrivacy()
  },
  methods: {
    routeByPrivacy() {
      const pages = getCurrentPages()
      const current = pages[pages.length - 1]
      const route = current?.route || ''
      const onConsent = route.includes('legal/consent')
      const onLogin = route.includes('auth/login')
      const onGatePage = onConsent || onLogin

      if (!hasPrivacyAgreed()) {
        if (!onConsent) safeReLaunch('/pages/legal/consent')
        return
      }

      if (!getToken()) {
        if (!onLogin) safeReLaunch('/pages/auth/login')
        return
      }

      if (getToken() && !onGatePage) {
        this.initApp()
      }
    },
    async initApp() {
      try {
        await checkApiOnline()
      } catch {
        // offline ok
      }
    },
  },
}
</script>

<style lang="scss">
@import './styles/global.scss';
</style>
