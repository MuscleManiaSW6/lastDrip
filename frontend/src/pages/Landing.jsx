import { useRef } from "react";
import LandingScene from "../components/three/LandingScene";

const Landing = () => {
  const wordAnchorRef = useRef();

  return (
    <main>
      <section className="relative min-h-screen overflow-hidden">
        <div className="relative z-10 pointer-events-none px-6 pt-24 md:px-12 md:pt-32">
          <p className="text-label text-olive">Modern Essentials</p>

          <h1 className="heading-display mt-5 text-6xl leading-[0.9] md:text-8xl">
            <span
              ref={wordAnchorRef}
              className="ml-6 inline-block opacity-0 md:ml-12"
            >
              LASTDRIP
            </span>
            <br />
            FROM A DIFFERENT <br /> PERSPECTIVE.
          </h1>

          <p className="mt-6 max-w-md text-sm leading-relaxed text-charcoal md:text-base">
            Modern clothing for people who move differently.
          </p>

          <button className="pointer-events-auto mt-8 border border-ink px-6 py-3 text-sm font-semibold tracking-wide transition duration-200 hover:bg-ink hover:text-bone">
            ENTER STORE
          </button>
        </div>

        <div className="absolute inset-0 z-0">
          <LandingScene anchorRef={wordAnchorRef} />
        </div>
      </section>
    </main>
  );
};

export default Landing;
