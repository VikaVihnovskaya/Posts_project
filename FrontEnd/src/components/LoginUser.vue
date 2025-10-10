<template>
  <div class="login-user">
    <h2>Login</h2>
    <form @submit.prevent="loginUser">
      <div>
        <label for="login">Login:</label>
        <input id="login" v-model="login" type="text" placeholder="Enter login" required />
      </div>

      <div>
        <label for="password">Password:</label>
        <input id="password" v-model="password" type="password" placeholder="Enter password" required />
      </div>

      <button type="submit" :disabled="auth.loading">{{ auth.loading ? 'Loading…' : 'Login' }}</button>
    </form>

    <p v-if="message" :class="{ error: isError }">{{ message }}</p>
    <p class="nav-link">
      Don't have an account?
      <router-link :to="{ name: 'RegisterUser', query: { redirect: route.query.redirect } }">
        Register
      </router-link>
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const login = ref('')
const password = ref('')
const message = ref('')
const isError = ref(false)

const loginUser = async () => {
  const { ok, message: msg } = await auth.login({ login: login.value, password: password.value })
  if (ok) {
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    router.replace(redirect || '/profile')
  } else {
    message.value = '❌ ' + (msg || 'Login failed')
    isError.value = true
  }
}
</script>

<style scoped>
.login-user {
  max-width: 400px;
  margin: 1rem auto;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
}
.login-user label {
  display: block;
  margin-bottom: 4px;
}
.login-user input {
  width: 100%;
  padding: 6px;
  margin-bottom: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
button {
  padding: 6px 12px;
  background: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
button:hover {
  background: #2a9d6f;
}
.error {
  color: red;
}
.nav-link {
  margin-top: 0.5rem;
  text-align: center;
}
</style>
