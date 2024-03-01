describe('Jest timezone test', () => {
  it('should have a UTC timezone', () => {
    expect(new Date().getTimezoneOffset()).toBe(0);
  });
});
