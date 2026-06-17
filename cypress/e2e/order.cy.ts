describe('Fastfood System E2E & Integrationstester', () => {

  it('Ska kunna hämta alla produkter och menyer från product-service', () => {
    cy.request({
      method: 'GET',
      url: '/api/products'
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.be.an('array');
      expect(response.body.length).to.be.greaterThan(0);
    });
  });

  it('Ska skicka en giltig order och få 202 Accepted', () => {
    cy.request({
      method: 'POST',
      url: '/api/orders',
      body: {
        customerId: "Arkan_Mac_Test",
        items: [
          { id: 1, name: "Falafelburgare", quantity: 1 }
        ]
      }
    }).then((response) => {
      expect(response.status).to.eq(202);
      expect(response.body).to.have.property('orderId');
      expect(response.body.message).to.eq('Order mottagen!');
    });
  });

  it('Ska neka ordern med 400 om items-listan är tom', () => {
    cy.request({
      method: 'POST',
      url: '/api/orders',
      failOnStatusCode: false,
      body: {
        customerId: "Arkan_Fel_Test",
        items: []
      }
    }).then((response) => {
      expect(response.status).to.eq(400);
    });
  });

  it('Ska ge 404 om man försöker hämta en order som inte existerar', () => {
    cy.request({
      method: 'GET',
      url: '/api/orders/finns-inte-i-databasen-123',
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(404);
    });
  });

});