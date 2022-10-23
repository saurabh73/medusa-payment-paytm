# Medusa Payment Paytm
![Medusa Hackathon 2022 - medusa-payment-paytm](https://iili.io/DBLRMG.jpg)
Add Paytm as a Payment Provider.

## Demo Link
- [medusa-payment-paytm](https://www.npmjs.com/package/medusa-payment-paytm)

## About
### Description
This Plugin enables to use Paytm Payment gateway solution in medusa website to simplify payment from customers. Customers can choose to pay from any credit/debit card, UPI, Netbanking, Paytm Wallet and EMI.

### Participants
# Medusa Payment Paytm
![Medusa Hackathon 2022 - medusa-payment-paytm](https://iili.io/DBLRMG.jpg)
Add Paytm as a Payment Provider.

## Demo Link
- [medusa-payment-paytm]()

## About
### Description
This Plugin enables to use Paytm Payment gateway solution in medusa website to simplify payment from customers. Customers can choose to pay from any credit/debit card, UPI, Netbanking, Paytm Wallet and EMI.

### Participants
| Name          | Github Handle                                   | Discord Handle    |
|---------------|-------------------------------------------------|-------------------|
| Gyanesh Singh | [GyaniRoman23](https://github.com/gyaniroman23) | gyaniroman23#5220 |
| Saurabh Dutta | [saurabh73](https://github.com/saurabh73)       | saurabh73#7660    |

## Set up Project

### Prerequisites
- Setup Medusa-Server
- You must have a merchant account on Paytm’s Merchant Dashboard. If you are a new merchant and want to create your account.
  ![Create Account](https://developer-assets.paytm.com/sftp/upload/feedbackuploads/Prerequisites_7c5385a07b.png)
- Get Merchant Credentials
  ![Get Merchant Credentials](https://developer-assets.paytm.com/sftp/upload/feedbackuploads/31631367_7701_4040_9179_DF_1_F4_F0_ABA_57_1_201_a_f83c539152.jpeg)
- Webhook Configuration
  ![Webhook Configuration](https://developer-assets.paytm.com/sftp/upload/cmsuploads/Webhook_Config_daaddc41e5.png?9627252.400000006)
  Set `Payment Notifcation URL` to `<medusa-server-url>/paytm/hooks`

### Install
- Install Plugin
  ```sh
  npm install medusa-payment-paytm
  ```
- Add to medusa-config.js
  ```js
  {
    resolve: `medusa-payment-paytm`,
    options: {
      "merchant_id": "<PAYTM Merchant ID>",
      "merchant_key": "<PAYTM Merchant KEY>",
      "test_mode": "<true or false>", // Optional (Default to false)
      "callback_url": "<Webhook URL>", // Payment Notifcation URL
    },
  }
  ``` 
- Enable `paytm` as a payment provider in Medusa admin settings (for Region `IN`)


## Resources
- [Paytm Gatewa Link](https://business.paytm.com)
- [Payment API DocsLink](https://business.paytm.com/docs/api/initiate-transaction-api?ref=payments)
- [Pre Requsites](https://business.paytm.com/docs/jscheckout-prerequisites?ref=jsCheckoutdoc)
