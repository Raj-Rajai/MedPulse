/**
 * MedPulse — Universal Frontend Validation Engine
 * Provides standardized email and 10-digit phone number validation across all forms.
 */
(function(window) {
  'use strict';

  const MedPulseValidation = {
    /**
     * Clean and validate a 10-digit mobile/phone number.
     * Allows optional +91 / 91 / 0 prefix, spaces, and hyphens.
     * Core valid number must be exactly 10 digits (typically starting with 6, 7, 8, 9).
     * @param {string} phone
     * @param {boolean} [allowEmpty=true]
     * @returns {{ valid: boolean, clean: string, error: string }}
     */
    validatePhone: function(phone, allowEmpty = true) {
      if (!phone || !phone.toString().trim()) {
        if (allowEmpty) {
          return { valid: true, clean: '', error: '' };
        }
        return { valid: false, clean: '', error: 'Phone number is required.' };
      }

      let raw = phone.toString().trim();
      // Remove spaces, hyphens, parentheses, and dots
      let clean = raw.replace(/[\s\-().]/g, '');

      // Handle standard country code prefixes
      if (clean.startsWith('+91') && clean.length === 13) {
        clean = clean.substring(3);
      } else if (clean.startsWith('91') && clean.length === 12 && /^[6-9]/.test(clean.substring(2))) {
        clean = clean.substring(2);
      } else if (clean.startsWith('0') && clean.length === 11 && /^[6-9]/.test(clean.substring(1))) {
        clean = clean.substring(1);
      }

      // Check if pure 10 digits
      if (!/^\d+$/.test(clean)) {
        return {
          valid: false,
          clean: clean,
          error: 'Phone number must contain only numeric digits.'
        };
      }

      if (clean.length !== 10) {
        return {
          valid: false,
          clean: clean,
          error: `Phone number must be exactly 10 digits (currently ${clean.length} digits).`
        };
      }

      if (!/^[6-9]\d{9}$/.test(clean)) {
        return {
          valid: false,
          clean: clean,
          error: 'Please enter a valid 10-digit mobile number (starts with 6, 7, 8, or 9).'
        };
      }

      return { valid: true, clean: clean, error: '' };
    },

    /**
     * Validate an email address.
     * @param {string} email
     * @param {boolean} [allowEmpty=true]
     * @returns {{ valid: boolean, clean: string, error: string }}
     */
    validateEmail: function(email, allowEmpty = true) {
      if (!email || !email.toString().trim()) {
        if (allowEmpty) {
          return { valid: true, clean: '', error: '' };
        }
        return { valid: false, clean: '', error: 'Email address is required.' };
      }

      const clean = email.toString().trim().toLowerCase();
      // Standard RFC 5322 regex pattern
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      if (!emailRegex.test(clean)) {
        return {
          valid: false,
          clean: clean,
          error: 'Please enter a valid email address (e.g. doctor@medpulse.edu).'
        };
      }

      return { valid: true, clean: clean, error: '' };
    },

    /**
     * Show validation error on an input element.
     * @param {HTMLInputElement} input
     * @param {string} errorMsg
     */
    showError: function(input, errorMsg) {
      if (!input) return;
      input.classList.remove('is-valid', 'input-valid');
      input.classList.add('is-invalid', 'input-invalid');

      let hint = input.parentNode.querySelector('.validation-error-hint');
      if (!hint) {
        hint = document.createElement('span');
        hint.className = 'validation-error-hint';
        input.parentNode.appendChild(hint);
      }
      hint.textContent = errorMsg;
      hint.style.display = 'block';

      let successHint = input.parentNode.querySelector('.validation-success-hint');
      if (successHint) successHint.style.display = 'none';
    },

    /**
     * Show valid state on an input element.
     * @param {HTMLInputElement} input
     * @param {string} [successMsg]
     */
    showValid: function(input, successMsg) {
      if (!input) return;
      input.classList.remove('is-invalid', 'input-invalid');
      input.classList.add('is-valid', 'input-valid');

      let hint = input.parentNode.querySelector('.validation-error-hint');
      if (hint) hint.style.display = 'none';

      if (successMsg) {
        let successHint = input.parentNode.querySelector('.validation-success-hint');
        if (!successHint) {
          successHint = document.createElement('span');
          successHint.className = 'validation-success-hint';
          input.parentNode.appendChild(successHint);
        }
        successHint.textContent = successMsg;
        successHint.style.display = 'block';
      }
    },

    /**
     * Clear validation indicators from an input element.
     * @param {HTMLInputElement} input
     */
    clearValidation: function(input) {
      if (!input) return;
      input.classList.remove('is-invalid', 'input-invalid', 'is-valid', 'input-valid');
      const hint = input.parentNode.querySelector('.validation-error-hint');
      if (hint) hint.style.display = 'none';
      const successHint = input.parentNode.querySelector('.validation-success-hint');
      if (successHint) successHint.style.display = 'none';
    },

    /**
     * Auto-attach real-time validation listeners to a phone input.
     * @param {HTMLInputElement|string} inputOrId
     * @param {boolean} [allowEmpty=true]
     */
    attachPhone: function(inputOrId, allowEmpty = true) {
      const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
      if (!input) return;

      // Set input mode for mobile dialpad
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('maxlength', '14');

      const handler = () => {
        const val = input.value.trim();
        if (!val && allowEmpty) {
          MedPulseValidation.clearValidation(input);
          return;
        }
        const res = MedPulseValidation.validatePhone(val, allowEmpty);
        if (!res.valid) {
          MedPulseValidation.showError(input, res.error);
        } else {
          MedPulseValidation.showValid(input);
        }
      };

      input.addEventListener('input', handler);
      input.addEventListener('blur', handler);
    },

    /**
     * Auto-attach real-time validation listeners to an email input.
     * @param {HTMLInputElement|string} inputOrId
     * @param {boolean} [allowEmpty=true]
     */
    attachEmail: function(inputOrId, allowEmpty = true) {
      const input = typeof inputOrId === 'string' ? document.getElementById(inputOrId) : inputOrId;
      if (!input) return;

      const handler = () => {
        const val = input.value.trim();
        if (!val && allowEmpty) {
          MedPulseValidation.clearValidation(input);
          return;
        }
        const res = MedPulseValidation.validateEmail(val, allowEmpty);
        if (!res.valid) {
          MedPulseValidation.showError(input, res.error);
        } else {
          MedPulseValidation.showValid(input);
        }
      };

      input.addEventListener('input', handler);
      input.addEventListener('blur', handler);
    }
  };

  window.MedPulseValidation = MedPulseValidation;
})(window);
