describe('Fastfood System E2E', () => {
  it('Ska skicka order via gateway och fa 202', () => {
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
});