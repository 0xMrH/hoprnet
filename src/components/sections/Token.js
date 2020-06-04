import React, { useState, useEffect } from 'react'
import SectionHeader from '../sections/partials/SectionHeader'
import GenericSection from '../sections/GenericSection'
import Input from '../elements/Input'
import Button from '../elements/Button'

const emailCheck = new RegExp('[^@]+@[^@]+.[a-zA-Z]{2,6}')

const Token = props => {
  const [email, setEmail] = useState(undefined)
  const [badEmail, setBadEmail] = useState(false)

  useEffect(() => {
    if (typeof email === 'undefined') {
      setBadEmail(false)
    } else {
      setBadEmail(!emailCheck.test(email))
    }
  }, [email])

  const [status, setStatus] = useState(undefined)
  // const isPending = status === 'pending'
  // const isSuccess = status === 'success'
  const isError = badEmail || status === 'error'
  const disabled = isError || typeof email === 'undefined'
  const href = `mailto:contact@hoprnet.io?from=${email}&subject=Contact`

  return (
    <GenericSection {...props} topDivider>
      <div className="container-xs">
        <SectionHeader
          data={{
            title: 'HOPR Token:',
            paragraph: 'You want to know more about the sale of our Token, subscribe here:',
          }}
          className="center-content"
        />
        <form
          style={{
            maxWidth: '420px',
            margin: '0 auto',
          }}
        >
          <div className="mb-24">
            <Input
              type="email"
              label="contact email"
              placeholder="Your best email.."
              formGroup="desktop"
              labelHidden
              value={email || ''}
              onChange={e => setEmail(e.target.value)}
              status={isError ? 'error' : undefined}
            >
              <Button
                color="primary"
                tag={disabled ? 'div' : 'a'}
                disabled={disabled}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                Subscribe
              </Button>
            </Input>
          </div>
        </form>
      </div>
    </GenericSection>
  )
}

export default Token
