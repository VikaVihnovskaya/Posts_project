<template>
  <div class="register-user">
    <h2>Register user </h2>

    <form @submit.prevent="registerUser">
      <div>
        <label for="login">Login:</label>
        <input id="login" v-model="login" type="text" placeholder="Enter login" required />
      </div>

      <div>
        <label for="password">Password:</label>
        <input id="password" v-model="password" type="password" placeholder="Enter password" required />
      </div>

      <button type="submit" :disabled="auth.loading">{{ auth.loading ? 'Loading…' : 'Register' }}</button>
    </form>

    <p v-if="message" :class="{ error: isError }">{{ message }}</p>
    <p class="nav-link">
      Already have an account?
      <router-link to="/login">Log in</router-link>
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

const registerUser = async () => {
  message.value = ''
  isError.value = false
  //  Регистрируем пользователя
  const { ok, message: msg } = await auth.register({ login: login.value, password: password.value })
  if (!ok) {
    message.value = '❌ ' + (msg || 'Registration failed')
    isError.value = true
    return
  }
  // Автоматический вход для установки cookie
  const { ok: okLogin, message: loginMsg } = await auth.login({ login: login.value, password: password.value })
  if (!okLogin) {
    // Если авто‑логин не удался, можно попросить зайти вручную
    message.value = 'ℹ️ Registered. Please log in: ' + (loginMsg || '')
    isError.value = true
    return
  }

  //  Успех → возвращаемся по redirect или в профиль
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
  router.replace(redirect || '/profile')
}
</script>

<style scoped>
.register-user {
  max-width: 400px;
  margin: 1rem auto;
  padding: 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}
.register-user label {
  display: block;
  margin-bottom: 4px;
}
.register-user input {
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
.error{
  color: red;
}
.nav-link {
  margin-top: 1rem;
  text-align: center;
  text-decoration: none;
}
.nav-link a:hover {
  text-decoration: underline;
}
</style>