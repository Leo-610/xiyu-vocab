<script>
import { checkApiOnline } from './utils/userService.js'
import { hasPrivacyAgreed } from './utils/privacy.js'
import { getToken } from './utils/api.js'

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
      const onGatePage = route.includes('legal/consent') || route.includes('auth/login')

      if (!hasPrivacyAgreed() && !route.includes('legal/consent')) {
        uni.reLaunch({ url: '/pages/legal/consent' })
        return
      }

      if (!hasPrivacyAgreed()) {
        return
      }

      if (!getToken() && !route.includes('auth/login')) {
        uni.reLaunch({ url: '/pages/auth/login' })
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
