/**
 * @file Contains the Greeter class for creating greetings.
 */

/**
 * Represents a Greeter that can create customized greetings.
 * This class demonstrates public, private, and protected members.
 */
export class Greeter {
    /**
     * The public greeting message.
     * @public
     */
    public greeting: string;

    /**
     * A secret message, not accessible from outside the class.
     * @private
     */
    private secret: string;

    /**
     * An ID for this Greeter, accessible by this class and its subclasses.
     * @protected
     */
    protected id: number;

    /**
     * Creates an instance of the Greeter.
     * @param {string} message The message to use for the greeting.
     */
    constructor(message: string) {
        this.greeting = message;
        this.secret = "This is a secret";
        this.id = Math.random();
    }

    /**
     * Generates the greeting string.
     * @returns {string} The full greeting.
     */
    public greet() {
        return "Hello, " + this.greeting;
    }

    /**
     * An example of a private method that cannot be called from outside.
     */
    private revealSecret() {
        // This would typically be used for internal logic only.
        console.log(this.secret);
    }
}
