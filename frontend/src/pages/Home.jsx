const Home = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bone px-6 text-ink">
      <div className="max-w-2xl text-center">
        <p className="text-label mb-5 text-olive">Modern Essentials</p>

        <h1 className="heading-display text-7xl md:text-8xl">LASTDRIP</h1>

        <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-charcoal md:text-lg">
          Modern clothing for people who move differently.
        </p>

        <button
          className="
            mt-8
            bg-olive
            px-7
            py-3
            text-sm
            font-semibold
            tracking-wide
            text-bone
            transition
            duration-200
            hover:bg-charcoal
            active:translate-y-px
          "
        >
          Explore Collection
        </button>
      </div>
    </div>
  );
};

export default Home;
